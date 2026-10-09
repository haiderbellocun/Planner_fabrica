// Prioridad de tareas: una sola fuente para etiqueta, tono, orden y variantes visuales.
// Los valores almacenados (low | medium | high | urgent) y sus etiquetas no cambian.
import { BADGE_TONES } from '@/lib/badgeColors';

export type TaskPriorityKey = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityMeta {
  label: string;
  /** Insignia: fondo tintado + texto "strong" (AA). */
  className: string;
  /** Texto suelto (tarjetas de Kanban): clases .priority-* de index.css. */
  textClass: string;
  /** Orden ascendente de gravedad, para ordenar. */
  rank: number;
  /** Fondo/borde de tarjeta (Mis tareas). */
  cardBg: string;
  /** Punto de color (calendario). */
  dotClass: string;
}

export const priorityConfig: Record<TaskPriorityKey, PriorityMeta> = {
  low: {
    label: 'Baja', className: BADGE_TONES.neutral, textClass: 'priority-low', rank: 0,
    cardBg: 'bg-muted/50 border-border', dotClass: 'bg-muted-foreground',
  },
  medium: {
    label: 'Media', className: BADGE_TONES.warning, textClass: 'priority-medium', rank: 1,
    cardBg: 'bg-accent/70 border-primary/40', dotClass: 'bg-warning',
  },
  high: {
    label: 'Alta', className: BADGE_TONES.escalated, textClass: 'priority-high', rank: 2,
    cardBg: 'bg-coral/10 border-coral/30', dotClass: 'bg-coral',
  },
  urgent: {
    label: 'Urgente', className: BADGE_TONES.danger, textClass: 'priority-urgent', rank: 3,
    cardBg: 'bg-destructive/10 border-destructive/30', dotClass: 'bg-destructive',
  },
};

export const PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(priorityConfig).map(([k, v]) => [k, v.label]),
);

/** Tolerante a valores desconocidos o vacíos: cae en "media", como hacía Mis tareas. */
export function getPriority(value: string | null | undefined): PriorityMeta {
  return priorityConfig[(value ?? 'medium') as TaskPriorityKey] ?? priorityConfig.medium;
}
