// Resolución del usuario de la sesión a partir del JWT ya verificado y del estado ACTUAL en la
// base de datos. El JWT sigue siendo la credencial; el rol y el estado activo se leen de la BD
// en cada petición para que deshabilitar una cuenta o cambiar un rol surta efecto de inmediato
// y no solo cuando el token expire. Sin dependencias para poder probarlo.
export interface SessionRow {
  is_active: boolean | null;
  profile_id: string | null;
  role: string | null;
}

export interface TokenClaims {
  id: string;
  profileId?: string;
  email: string;
  role?: string;
}

export type SessionResolution =
  | { ok: true; user: { id: string; profileId?: string; email: string; role: string } }
  | { ok: false; status: 401; error: string };

export function resolveSessionUser(claims: TokenClaims, row: SessionRow | undefined): SessionResolution {
  if (!row) return { ok: false, status: 401, error: 'Invalid token' };
  if (row.is_active !== true) return { ok: false, status: 401, error: 'Account is disabled' };
  return {
    ok: true,
    user: {
      id: claims.id,
      // La BD manda; el valor del token solo se usa si el perfil no se pudo resolver.
      profileId: row.profile_id ?? claims.profileId,
      email: claims.email,
      role: row.role || 'user',
    },
  };
}

// Un perfil con varias filas en user_roles se resuelve por el rol de mayor privilegio.
export const SESSION_USER_SQL = `
  SELECT u.is_active, p.id AS profile_id, ur.role::TEXT AS role
  FROM public.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE u.id = $1
  ORDER BY CASE ur.role::TEXT WHEN 'admin' THEN 0 WHEN 'project_leader' THEN 1 ELSE 2 END
  LIMIT 1`;
