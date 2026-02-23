import type { ChartConfig } from '@/components/ui/chart';
import { chartColors, gridColor, axisTick, CHART_GRID_STYLE, CHART_AXIS_STYLE, BAR_RADIUS } from '@/components/charts/chartTheme';

export { BAR_RADIUS };

// Align with chartTheme — teal primary, no heavy gray
export const CHART_COLORS = {
  indigo: chartColors.blue,
  indigoLight: '#6366F1',
  yellow: chartColors.yellow,
  yellowLight: '#FCD34D',
  teal: chartColors.teal,
  tealDark: '#0BBFB7',
  muted: chartColors.soft,
  mutedLight: chartColors.muted,
  bgPrimary: '#EAF6F8',
  bgCard: '#FFFFFF',
  bgBorder: '#E2E8F0',
  grid: gridColor,
} as const;

// Ordered palette for series (donut/polar sequence — max 3 visible)
export const SERIES_COLORS = [
  CHART_COLORS.indigo,
  CHART_COLORS.yellow,
  CHART_COLORS.teal,
  CHART_COLORS.indigoLight,
  CHART_COLORS.yellowLight,
  CHART_COLORS.tealDark,
  CHART_COLORS.muted,
  CHART_COLORS.mutedLight,
];

// Status name → color mapping
export const STATUS_COLORS: Record<string, string> = {
  'Sin iniciar': CHART_COLORS.muted,
  'En proceso': CHART_COLORS.indigo,
  'En pausa': CHART_COLORS.indigoLight,
  'En revisión': CHART_COLORS.yellow,
  'Ajustes': CHART_COLORS.yellowLight,
  'Finalizado': CHART_COLORS.teal,
};

// Build a ChartConfig from status data
export function buildStatusChartConfig(statuses: { name: string; color?: string }[]): ChartConfig {
  const config: ChartConfig = {};
  statuses.forEach((s) => {
    const key = s.name.toLowerCase().replace(/\s+/g, '_');
    config[key] = {
      label: s.name,
      color: STATUS_COLORS[s.name] || CHART_COLORS.muted,
    };
  });
  return config;
}

// Format seconds to human-readable
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.round((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

// Format hours to human-readable
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${Math.round(hours * 10) / 10}h`;
}

// SVG gradient definition for area charts
export function GradientDef({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.25} />
        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

// Common chart axis styling — from chartTheme
export const AXIS_STYLE = {
  ...CHART_AXIS_STYLE,
  tick: { fontSize: axisTick.fontSize, fill: axisTick.fill },
};

// Common grid styling — from chartTheme
export const GRID_STYLE = {
  ...CHART_GRID_STYLE,
  strokeOpacity: 0.8,
};
