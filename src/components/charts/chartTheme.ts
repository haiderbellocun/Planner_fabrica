/**
 * Central chart theme — teal primary, consistent grid/axis/tooltip.
 * Use for Recharts: CartesianGrid, XAxis, YAxis, Bar radius, tooltips.
 */
export const chartColors = {
  teal: '#0DD9D0',
  tealDeep: '#067A76',
  coral: '#FF6B4A',
  blue: '#4F46E5',
  indigoLight: '#6366F1',
  yellow: '#E8A317',
  green: '#0CA35A',
  magenta: '#E0619A',
  info: '#0EA5E9',
  soft: '#DDF6F7',
  muted: '#DDF6F7',
} as const;

export const gridColor = '#E1EFEE';

export const axisTick = {
  fill: '#6B7F7C',
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
