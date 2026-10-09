import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Higiene de caché: si cambia la persona autenticada (cierre de sesión o inicio como otro usuario en la
 * misma pestaña), se vacía la caché de consultas para que nunca se vean datos del usuario anterior
 * (tareas, notificaciones, reportes…). No toca la autenticación: solo observa quién es el usuario.
 * La primera hidratación (sin usuario → usuario) no vacía nada.
 */
export function QueryCacheGuard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current !== null && previous.current !== userId) queryClient.clear();
    previous.current = userId;
  }, [userId, queryClient]);

  return null;
}
