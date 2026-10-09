// Error de una petición a la API conservando el estado HTTP, para poder distinguir permisos
// (401/403) de fallos de red o de servidor sin perder el mensaje que envió el servidor.
export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export const getErrorStatus = (error: unknown): number | undefined =>
  error instanceof ApiRequestError ? error.status : undefined;

export const isPermissionError = (error: unknown): boolean => {
  const s = getErrorStatus(error);
  return s === 401 || s === 403;
};

/**
 * Errores del cliente (4xx) que reintentar no resuelve. Se exceptúan 408 (tiempo de espera agotado) y
 * 429 (demasiadas peticiones): son transitorios y se reintentan con el límite habitual.
 */
export const isClientError = (error: unknown): boolean => {
  const s = getErrorStatus(error);
  return s !== undefined && s >= 400 && s < 500 && s !== 408 && s !== 429;
};

/**
 * Política de reintento automático de TanStack Query: igual que la predeterminada (3 intentos)
 * salvo errores 4xx permanentes (no 408/429), que fallan de inmediato (un 403 no se arregla reintentando y retrasaba
 * ~7 s la explicación al usuario).
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean =>
  !isClientError(error) && failureCount < 3;

/** Mensaje para el usuario: conserva el del servidor y añade contexto según el estado. */
export function describeError(error: unknown, fallback = 'No se pudo cargar la información.'): { title?: string; message: string } {
  const raw = error instanceof Error && error.message ? error.message : '';
  const status = getErrorStatus(error);
  if (status === 403) return { title: 'Sin permiso', message: raw || 'No tienes permiso para ver esta información.' };
  if (status === 401) return { title: 'Sesión no válida', message: `Tu sesión no es válida o expiró. Vuelve a iniciar sesión.${raw ? ` (${raw})` : ''}` };
  if (status === 404) return { message: raw || 'No se encontró la información solicitada.' };
  if (status !== undefined && status >= 500) return { message: `${fallback} El servidor respondió con un error${raw ? `: ${raw}` : '.'}` };
  if (raw && /failed to fetch|networkerror|load failed/i.test(raw)) return { message: `${fallback} Revisa tu conexión.` };
  return { message: raw ? `${fallback} ${raw}` : fallback };
}
