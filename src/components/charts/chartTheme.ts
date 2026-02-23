/**
 * Central chart theme — teal primary, consistent grid/axis/tooltip.
 * Use for Recharts: CartesianGrid, XAxis, YAxis, Bar radius, tooltips.
 */
export const chartColors = {
  teal: '#18C7C1',
  blue: '#4F46E5',
  yellow: '#FBBF24',
  soft: '#DDF6F7',
  muted: '#DDF6F7',
} as const;

export const gridColor = '#E6FAFA';

export const axisTick = {
  fill: '#64748B',
  fontSize: 12,
} as const;

export const CHART_GRID_STYLE = {
  stroke: gridColor,
  strokeDasharray: '3 3',
} as const;

export const CHART_AXIS_STYLE = {
  axisLine: false,
  tickLine: false,
  tick: { fill: axisTick.fill, fontSize: axisTick.fontSize },
} as const;

export const BAR_RADIUS = 10;
