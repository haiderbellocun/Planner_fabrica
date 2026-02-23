import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    profileId?: string;
    email: string;
    role?: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (env.NODE_ENV !== 'production') {
        console.log('❌ No token provided');
      }
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const secret = env.JWT_SECRET;

    try {
      const decoded = jwt.verify(token, secret) as {
        id: string;
        profileId?: string;
        profile_id?: string;
        email: string;
        role?: string;
      };

      const rawProfileId = decoded.profileId ?? (decoded as any).profile_id;
      const profileId =
        typeof rawProfileId === 'string' && rawProfileId.trim() !== '' ? rawProfileId.trim() : undefined;

      if (env.NODE_ENV !== 'production') {
        console.log('✅ Token decoded:', {
          id: decoded.id,
          profileId,
          email: decoded.email,
          role: decoded.role,
        });
      }

      req.user = {
        id: decoded.id,
        profileId,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch (error) {
      if (env.NODE_ENV !== 'production') {
        console.log('❌ Token verification failed:', error instanceof Error ? error.message : error);
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    if (env.NODE_ENV !== 'production') {
      console.log('❌ Auth middleware error:', error);
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
};
