import { apiBaseUrl } from './api';

/**
 * Convierte avatar_url (relativo o absoluto) en URL absoluta para el navegador.
 * En producción el front puede estar en otro dominio que el API; las rutas
 * relativas (/avatars/...) deben resolverse contra la URL del backend.
 */
export function buildAvatarSrc(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
  const path = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}
