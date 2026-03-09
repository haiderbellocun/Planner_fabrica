import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { apiBaseUrl } from '@/lib/api';

// Minutos de inactividad antes de cerrar sesión (ej: 120 = 2 horas)
const INACTIVITY_TIMEOUT_MINUTES = 120;

const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

// Local User type (replacing Supabase types)
export interface LocalUser {
  id: string;
  profileId: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: 'admin' | 'project_leader' | 'user';
}

export type AppRole = 'admin' | 'project_leader' | 'user';

interface AuthContextType {
  user: LocalUser | null;
  session: { token: string } | null;
  profile: LocalUser | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isProjectLeader: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Helper function to make authenticated requests
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('taskflow_token');
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
  };

  // Fetch current user profile
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('taskflow_token');
      if (!token) {
        setUser(null);
        setSession(null);
        return;
      }

      const response = await authenticatedFetch(`${apiBaseUrl}/api/auth/me`);

      if (!response.ok) {
        // Token invalid or expired
        localStorage.removeItem('taskflow_token');
        setUser(null);
        setSession(null);
        return;
      }

      const data = await response.json();
      setUser(data.user);
      setSession({ token });
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('taskflow_token');
      setUser(null);
      setSession(null);
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await fetchProfile();
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Login failed') };
      }

      // Store token
      localStorage.setItem('taskflow_token', data.token);

      // Update state
      setUser(data.user);
      setSession({ token: data.token });

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Registration failed') };
      }

      // Store token
      localStorage.setItem('taskflow_token', data.token);

      // Update state
      setUser(data.user);
      setSession({ token: data.token });

      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await authenticatedFetch(`${apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      localStorage.removeItem('taskflow_token');
      setUser(null);
      setSession(null);
    }
  };

  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  // Cerrar sesión por inactividad
  useEffect(() => {
    if (!session) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const scheduleLogout = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        signOutRef.current();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      scheduleLogout();
    };

    scheduleLogout();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, onActivity));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [session]);

  // Compute roles
  const roles: AppRole[] = user?.role ? [user.role] : [];
  const isAdmin = user?.role === 'admin';
  const isProjectLeader = user?.role === 'project_leader' || isAdmin;

  const value = {
    user,
    session,
    profile: user,
    roles,
    isLoading,
    isAdmin,
    isProjectLeader,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export authenticated fetch helper for use in other hooks
export const useAuthenticatedFetch = () => {
  const token = localStorage.getItem('taskflow_token');

  return {
    fetch: async (url: string, options: RequestInit = {}) => {
      return fetch(`${apiBaseUrl}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });
    },
    token,
  };
};
