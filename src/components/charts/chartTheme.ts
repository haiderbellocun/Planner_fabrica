/**
 * Central chart theme — teal primary, consistent grid/axis/tooltip.
 * Use for Recharts: CartesianGrid, XAxis, YAxis, Bar radius, tooltips.
 */
export const chartColors = {
  teal: '#0DD9D0',
  tealDeep: '#067A76',
  coral: '#FF6B4A',
  // Deep warm accent — brand-safe stand-in for the old indigo/blue "second series" color
  rust: '#B45309',
  // Muted teal-grey neutral — for secondary/paused states (was indigoLight)
  slate: '#7A9391',
  yellow: '#E8A317',
  green: '#0CA35A',
  magenta: '#E0619A',
  info: '#0EA5E9',
  soft: '#DDF6F7',
  muted: '#DDF6F7',
} as const;

// Tinta para texto/etiquetas dentro de graficos: variantes oscuras de cada serie (>=4.5:1 sobre blanco).
export const chartInk = {
  strong: '#1F2A2A',
  muted: '#5F7371',
  green: '#067647',
  teal: '#067A76',
  amber: '#92600A',
  coral: '#C2412D',
} as const;

// Rellenos suaves, pistas y celdas vacias.
export const chartSoft = {
  green: '#E7F6EE',
  coral: '#FFF1ED',
  coralBorder: '#FFD2C8',
  neutral: '#D5E3E1',
  track: '#E7EEED',
  empty: '#F4FAF9',
  teal: '#BFEFF0',
  page: '#EAF6F8',
  border: '#E2ECEB',
  yellowLight: '#F0BE5C',
} as const;

export const chartSurface = { card: '#FFFFFF' } as const;

// Sombra de tooltips de graficos (equivale al nivel "floating" del sistema de sombras).
export const chartShadow = '0 8px 24px rgba(10, 20, 20, 0.10)';

export const gridColor = '#E1EFEE';

export const axisTick = {
  fill: chartInk.muted,
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
