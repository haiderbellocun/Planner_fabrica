// Manejo centralizado de una cuenta deshabilitada (401 "Account is disabled" del servidor).
// Otros 401 (token vencido o inválido) NO pasan por aquí y conservan su comportamiento.
export const TOKEN_KEY = 'taskflow_token';
export const ACCOUNT_DISABLED_ERROR = 'Account is disabled';
const NOTICE_KEY = 'taskflow_account_disabled';
export const ACCOUNT_DISABLED_MESSAGE =
  'Tu cuenta fue deshabilitada. Contacta a un administrador si crees que es un error.';

export function isAccountDisabledResponse(status: number, body: unknown): boolean {
  return status === 401 && (body as { error?: unknown } | null)?.error === ACCOUNT_DISABLED_ERROR;
}

interface SessionEnv {
  localStorage: Pick<Storage, 'removeItem'>;
  sessionStorage: Pick<Storage, 'setItem' | 'getItem' | 'removeItem'>;
  location: { hash: string; reload: () => void };
}

let handling = false;

/** Borra la sesión local, deja un aviso para la pantalla de login y redirige una sola vez. */
export function handleAccountDisabled(env: SessionEnv = window): void {
  env.localStorage.removeItem(TOKEN_KEY);
  try { env.sessionStorage.setItem(NOTICE_KEY, '1'); } catch { /* sin aviso si el almacenamiento falla */ }
  if (handling) return; // varias peticiones fallando a la vez: una sola redirección
  handling = true;
  if (env.location.hash.startsWith('#/auth')) {
    handling = false; // ya estamos en el login: sin recarga, evita bucles
    return;
  }
  env.location.hash = '#/auth';
  env.location.reload(); // reinicia el estado en memoria (usuario, caché de consultas)
}

/** Solo marca el aviso (lo usa AuthContext, que ya limpia su propio estado). */
export function markAccountDisabledNotice(env: Pick<SessionEnv, 'sessionStorage'> = window): void {
  try { env.sessionStorage.setItem(NOTICE_KEY, '1'); } catch { /* noop */ }
}

/** Lee el aviso sin borrarlo (seguro bajo doble render de StrictMode). */
export function peekAccountDisabledNotice(env: Pick<SessionEnv, 'sessionStorage'> = window): boolean {
  try { return env.sessionStorage.getItem(NOTICE_KEY) === '1'; } catch { return false; }
}

/** Devuelve true una sola vez si hay un aviso pendiente de cuenta deshabilitada. */
export function consumeAccountDisabledNotice(env: Pick<SessionEnv, 'sessionStorage'> = window): boolean {
  try {
    const pending = env.sessionStorage.getItem(NOTICE_KEY) === '1';
    if (pending) env.sessionStorage.removeItem(NOTICE_KEY);
    return pending;
  } catch {
    return false;
  }
}

/** Solo para pruebas. */
export function __resetSessionHandlingForTests(): void { handling = false; }
