import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import pool from '../config/database.js';
import { effectiveRole, validateCreateUserInput } from '../utils/userValidation.js';

// Solo admins y project_leaders pueden administrar usuarios
function ensureAdminOrLeader(req: AuthRequest, res: Response) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'project_leader') {
    res.status(403).json({ error: 'Solo administradores y project_leaders pueden administrar usuarios' });
    return false;
  }
  return true;
}

// Activar/desactivar cuentas queda exclusivo de admin -- un project_leader no
// debe poder deshabilitar la cuenta de otra persona (incluido otro admin).
function ensureAdmin(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Solo administradores pueden activar o desactivar cuentas' });
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
 * Crea un nuevo usuario + profile + rol dentro de una transacción atómica
 */
export const createUser = async (req: AuthRequest, res: Response) => {
  if (!ensureAdminOrLeader(req, res)) return;

  const parsed = validateCreateUserInput(req.body);
  if ('error' in parsed) {
    return res.status(400).json({ error: parsed.error });
  }
  const { full_name, email, password, cargo } = parsed.value;

  // Solo un ADMIN puede asignar roles elevados
  const normalizedRole = effectiveRole(req.user?.role, parsed.value.role);

  let passwordHash: string;
  try {
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese correo' });
    }

    passwordHash = await bcrypt.hash(password, 10);
  } catch (error) {
    console.error('Admin createUser precheck error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // BEGIN/COMMIT deben ir en la MISMA conexión: pool.query() puede usar conexiones distintas.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO public.users (email, full_name, password_hash, avatar_url, is_active)
       VALUES ($1, $2, $3, NULL, TRUE)
       RETURNING id, email, full_name`,
      [email, full_name, passwordHash]
    );
    const newUser = userResult.rows[0];

    // El trigger en public.users crea el perfil automáticamente.
    // Intentamos actualizar el perfil existente; si no existe (sin trigger), lo insertamos.
    let profileId: string;

    const existingProfile = await client.query(
      `SELECT id FROM public.profiles WHERE user_id = $1`,
      [newUser.id]
    );

    if (existingProfile.rows.length > 0) {
      profileId = existingProfile.rows[0].id;
      await client.query(
        `UPDATE public.profiles SET full_name = $1, email = $2, cargo = $3 WHERE id = $4`,
        [full_name, email, cargo || null, profileId]
      );
    } else {
      const profileResult = await client.query(
        `INSERT INTO public.profiles (user_id, full_name, avatar_url, email, cargo)
         VALUES ($1, $2, NULL, $3, $4)
         RETURNING id`,
        [newUser.id, full_name, email, cargo || null]
      );
      profileId = profileResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2::app_role)`,
      [profileId, normalizedRole]
    );

    await client.query('COMMIT');

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
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Admin createUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/admin/users/:id/active
 * Activa / desactiva un usuario (soft delete)
 */
export const updateUserActive = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureAdmin(req, res)) return;

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

