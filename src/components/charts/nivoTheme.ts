// Theme de Nivo para el módulo "Plan de Trabajo" — construido sobre los mismos
// tokens de chartTheme.ts (teal de marca) para que Nivo y Recharts se vean como
// un solo sistema visual, no dos librerías distintas pegadas una junto a otra.
import type { PartialTheme } from '@nivo/theming';
import { chartColors, gridColor, axisTick } from './chartTheme';

export const nivoTheme: PartialTheme = {
  background: 'transparent',
  text: {
    fontSize: 11,
    fill: axisTick.fill,
    fontFamily: 'inherit',
  },
  axis: {
    domain: { line: { stroke: gridColor, strokeWidth: 1 } },
    ticks: {
      line: { stroke: gridColor, strokeWidth: 1 },
      text: { fontSize: 11, fill: axisTick.fill },
    },
    legend: { text: { fontSize: 11, fill: axisTick.fill, fontWeight: 600 } },
  },
  grid: {
    line: { stroke: gridColor, strokeWidth: 1 },
  },
  legends: {
    text: { fontSize: 11, fill: axisTick.fill },
  },
  tooltip: {
    container: {
      background: 'white',
      color: '#1f2937',
      fontSize: 12,
      borderRadius: 10,
      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
      border: `1px solid ${gridColor}`,
      padding: '8px 12px',
    },
  },
  crosshair: {
    line: { stroke: chartColors.tealDeep, strokeWidth: 1, strokeOpacity: 0.4 },
  },
  labels: {
    text: { fontSize: 11, fill: '#1f2937' },
  },
  dots: {
    text: { fontSize: 10, fill: axisTick.fill },
  },
};

// Serie categórica: teal como color de identidad, el resto de la paleta existente
// como acompañamiento (sin morado/índigo), coral/rojo reservado para alertas.
export const nivoSeriesColors = [
  chartColors.teal,
  chartColors.tealDeep,
  chartColors.rust,
  chartColors.slate,
  chartColors.yellow,
  chartColors.green,
  chartColors.magenta,
];

// Escala secuencial monocromática (teal) para el heatmap — nunca arcoíris.
export const nivoHeatmapColors = {
  type: 'sequential' as const,
  scheme: 'blues' as const, // fallback visual; se sobreescribe con colors custom abajo si aplica
};

export const NIVO_TEAL_SCALE = ['#EAFBFA', '#C7F3F1', '#8FEAE6', '#4FDBD5', chartColors.teal, chartColors.tealDeep];

export const STATUS_COLOR_FALLBACK = chartColors.muted;
export const ALERT_COLOR = chartColors.coral;
