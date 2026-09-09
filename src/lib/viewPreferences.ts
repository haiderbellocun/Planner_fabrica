// Preferencias de vista/filtros de tareas por usuario y proyecto.
// Se guardan en localStorage de ESTE dispositivo/navegador -- no se sincronizan entre
// equipos ni dispositivos. No usar para nada que deba compartirse entre personas.
const PREFIX = 'taskflow';

function storageKey(userId: string | undefined, projectId: string | undefined, suffix: string): string {
  return `${PREFIX}:${userId ?? 'anon'}:${projectId ?? 'unknown'}:${suffix}`;
}

export function getStoredJSON<T>(userId: string | undefined, projectId: string | undefined, suffix: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, projectId, suffix));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setStoredJSON(userId: string | undefined, projectId: string | undefined, suffix: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey(userId, projectId, suffix), JSON.stringify(value));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) -- la preferencia simplemente no persiste.
  }
}
