// Presentación única de las bandas de ocupación semanal (la lógica vive en lib/capacityMetrics.ts).
// Mismo nivel → mismo color en Equipo, Capacidad y Capacidad Operativa. Solo tokens semánticos del sistema.
import type { OccupancyLevel } from '@/lib/capacityMetrics';
import { CHART_COLORS } from '@/components/reports/ReportCharts';
import { chartColors } from '@/components/charts/chartTheme';

/** Insignia con borde (conteos y etiquetas de estado). */
export const OCCUPANCY_BADGE_CLASSES: Record<OccupancyLevel, string> = {
  low: 'bg-info/10 text-info-strong border-info/30',
  available: 'bg-success/10 text-success-strong border-success/30',
  high: 'bg-warning/10 text-warning-strong border-warning/30',
  over: 'bg-destructive/10 text-destructive-strong border-destructive/30',
};

/** Color de barras y puntos de gráfico. */
export const OCCUPANCY_HEX: Record<OccupancyLevel, string> = {
  low: chartColors.info,
  available: CHART_COLORS.green,
  high: CHART_COLORS.yellow,
  over: CHART_COLORS.coral,
};
