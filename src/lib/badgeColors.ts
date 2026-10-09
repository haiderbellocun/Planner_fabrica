// Paleta centralizada para insignias de estado/prioridad en toda la app.
// Cada dominio (prioridad de tareas, prioridad de solicitudes de marketing, estados de
// entregas, etc.) conserva su propio enum y etiqueta: solo el color real se comparte.
// Fondo = tinte del token semantico; texto = variante "-strong" (>= 4.5:1, ver index.css).
export const BADGE_TONES = {
  neutral:   'bg-muted text-muted-foreground',
  info:      'bg-info/10 text-info-strong',
  success:   'bg-success/10 text-success-strong',
  warning:   'bg-warning/15 text-warning-strong',
  // Paso intermedio entre warning y danger: prioridad "alta", distinguible de "media" y de "urgente".
  escalated: 'bg-coral/10 text-coral-strong',
  danger:    'bg-destructive/10 text-destructive-strong',
  special:   'bg-primary/10 text-primary-deep',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;
