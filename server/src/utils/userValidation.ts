// Validación de entrada para la creación de usuarios (sin dependencias, probada desde Vitest).
// La contraseña no se valida aquí más allá de ser obligatoria: su política queda como estaba originalmente.

export const ALLOWED_ROLES = ['admin', 'project_leader', 'user'] as const;
export type AppRole = (typeof ALLOWED_ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  cargo: string | null;
  role: AppRole;
}

export type CreateUserValidation =
  | { ok: true; value: CreateUserInput }
  | { ok: false; error: string };

export function validateCreateUserInput(body: unknown): CreateUserValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

  const full_name = str(b.full_name)?.trim();
  const email = str(b.email)?.trim();
  const password = str(b.password);

  if (!full_name || !email || !password) {
    return { ok: false, error: 'full_name, email y password son requeridos' };
  }
  if (full_name.length > 255) return { ok: false, error: 'full_name no puede superar 255 caracteres' };
  if (email.length > 255 || !EMAIL_RE.test(email)) return { ok: false, error: 'El correo no es válido' };

  let cargo: string | null = null;
  if (b.cargo !== undefined && b.cargo !== null) {
    if (typeof b.cargo !== 'string') return { ok: false, error: 'cargo debe ser texto' };
    cargo = b.cargo.trim() || null;
    if (cargo && cargo.length > 255) return { ok: false, error: 'cargo no puede superar 255 caracteres' };
  }

  let role: AppRole = 'user';
  if (b.role !== undefined && b.role !== null) {
    if (typeof b.role !== 'string' || !(ALLOWED_ROLES as readonly string[]).includes(b.role)) {
      return { ok: false, error: 'role no es válido' };
    }
    role = b.role as AppRole;
  }

  return { ok: true, value: { full_name, email, password, cargo, role } };
}

/** Un project_leader solo puede crear usuarios con rol 'user'; solo un admin asigna roles elevados. */
export function effectiveRole(requesterRole: string | undefined, requested: AppRole): AppRole {
  return requesterRole === 'admin' ? requested : 'user';
}
