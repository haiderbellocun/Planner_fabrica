import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BADGE_TONES, type BadgeTone } from '@/lib/badgeColors';
import { getPriority } from '@/lib/priority';

const BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap';

/** Insignia de estado con tono semántico (fondo tintado + texto "strong", AA). */
export function StatusBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn(BASE, BADGE_TONES[tone], className)}>{children}</span>;
}

/** Prioridad de tarea: etiqueta y color definidos en lib/priority.ts. */
export function PriorityBadge({ priority, className }: { priority: string | null | undefined; className?: string }) {
  const p = getPriority(priority);
  return <span className={cn(BASE, p.className, className)}>{p.label}</span>;
}

/**
 * Estado de tarea. El color configurable del estado va en un punto (forma + color) y el texto usa
 * el color de texto del sistema: un color arbitrario como texto (p. ej. amarillo) no garantiza contraste.
 */
export function TaskStatusBadge({ name, color, className }: { name?: string | null; color?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground whitespace-nowrap', className)}>
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color || 'hsl(var(--muted-foreground))' }}
      />
      {name || 'Sin estado'}
    </span>
  );
}
