import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';

// Solo admins y project_leaders pueden administrar usuarios
function ensureAdminOrLeader(req: AuthRequest, res: Response) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'project_leader') {
    res.status(403).json({ error: 'Solo administradores y project_leaders pueden administrar usuarios' });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/users
 * Lista básica de usuarios con estado y rol
 */
export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureAdminOrLeader(req, res)) return;

    const result = await query(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.is_active,
         p.id   AS profile_id,
         p.cargo,
         COALESCE(ur.role::TEXT, 'user') AS role
       FROM public.users u
       LEFT JOIN public.profiles p ON p.user_id = u.id
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       ORDER BY u.full_name ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Admin listUsers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/admin/users
 * Crea un nuevo usuario + profile + rol
 */
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureAdminOrLeader(req, res)) return;

    const { full_name, email, password, cargo, role } = req.body as {
      full_name?: string;
      email?: string;
      password?: string;
      cargo?: string | null;
      role?: 'admin' | 'project_leader' | 'user';
    };

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email y password son requeridos' });
    }

    // Solo un ADMIN puede asignar roles elevados.
    // Los project_leaders siempre crean usuarios normales.
    let normalizedRole: 'admin' | 'project_leader' | 'user' = 'user';
    if (req.user?.role === 'admin') {
      normalizedRole = role || 'user';
    }

    // Verificar que no exista el correo
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const userResult = await query(
      `INSERT INTO public.users (email, full_name, password_hash, avatar_url, is_active)
       VALUES ($1, $2, $3, NULL, TRUE)
       RETURNING id, email, full_name`,
      [email, full_name, passwordHash]
    );
    const newUser = userResult.rows[0];

    // Crear perfil
    const profileResult = await query(
      `INSERT INTO public.profiles (user_id, full_name, avatar_url, email, cargo)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING id`,
      [newUser.id, full_name, email, cargo || null]
    );
    const profileId = profileResult.rows[0].id;

    // Asignar rol
    await query(
      `INSERT INTO public.user_roles (user_id, role)
       VALUES ($1, $2)`,
      [profileId, normalizedRole]
    );

    res.status(201).json({
      id: newUser.id,
      profile_id: profileId,
      email: newUser.email,
      full_name: newUser.full_name,
      cargo: cargo || null,
      role: normalizedRole,
      is_active: true,
    });
  } catch (error) {
    console.error('Admin createUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/admin/users/:id/active
 * Activa / desactiva un usuario (soft delete)
 */
export const updateUserActive = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureAdminOrLeader(req, res)) return;

    const { id } = req.params;
    const { is_active } = req.body as { is_active?: boolean };

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) es requerido' });
    }

    const result = await query(
      `UPDATE public.users
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, is_active`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Admin updateUserActive error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

