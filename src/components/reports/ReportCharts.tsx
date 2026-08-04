import type { ChartConfig } from '@/components/ui/chart';
import { chartColors, gridColor, axisTick, CHART_GRID_STYLE, CHART_AXIS_STYLE, BAR_RADIUS } from '@/components/charts/chartTheme';

export { BAR_RADIUS };

// Align with chartTheme — teal + coral brand pair, fixed categorical order
export const CHART_COLORS = {
  teal: chartColors.teal,
  tealDark: chartColors.tealDeep,
  coral: chartColors.coral,
  indigo: chartColors.blue,
  indigoLight: chartColors.indigoLight,
  yellow: chartColors.yellow,
  yellowLight: '#F0BE5C',
  green: chartColors.green,
  magenta: chartColors.magenta,
  muted: chartColors.soft,
  mutedLight: chartColors.muted,
  bgPrimary: '#EAF6F8',
  bgCard: '#FFFFFF',
  bgBorder: '#E2ECEB',
  grid: gridColor,
} as const;

// Fixed categorical order — teal first (brand), never re-cycled per filter
export const SERIES_COLORS = [
  CHART_COLORS.teal,
  CHART_COLORS.coral,
  CHART_COLORS.indigo,
  CHART_COLORS.yellow,
  CHART_COLORS.magenta,
  CHART_COLORS.green,
  CHART_COLORS.indigoLight,
  CHART_COLORS.yellowLight,
];

// Status name → color mapping (matches --status-* tokens in index.css)
export const STATUS_COLORS: Record<string, string> = {
  'Sin iniciar': axisTick.fill,
  'En proceso': CHART_COLORS.teal,
  'En pausa': CHART_COLORS.indigoLight,
  'En revisión': CHART_COLORS.yellow,
  'Ajustes': CHART_COLORS.coral,
  'Finalizado': CHART_COLORS.green,
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
