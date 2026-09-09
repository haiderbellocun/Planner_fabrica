// Paleta centralizada para insignias de estado/prioridad en toda la app.
// Cada dominio (prioridad de tareas, prioridad de solicitudes de marketing, estados de
// entregas, etc.) conserva su propio enum y etiqueta — solo el color real se comparte,
// para que todas las insignias se vean consistentes en vez de cada feature inventando
// su propio tono de rojo/ámbar/verde.
export const BADGE_TONES = {
  neutral:   'bg-slate-100 text-slate-600',
  info:      'bg-blue-100 text-blue-700',
  success:   'bg-green-100 text-green-700',
  warning:   'bg-amber-100 text-amber-700',
  // Paso intermedio entre warning y danger — usado por prioridad "alta" (que en varias
  // pantallas debe distinguirse visualmente tanto de "media" como de "urgente"/"crítica").
  escalated: 'bg-orange-100 text-orange-700',
  danger:    'bg-red-100 text-red-700',
  special:   'bg-purple-100 text-purple-700',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;
