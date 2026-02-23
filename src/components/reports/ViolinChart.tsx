import { useMemo } from 'react';
import type { TimeDistribution } from '@/hooks/useReports';

// Gaussian kernel density estimation
function kernelDensity(data: number[], bandwidth: number, points: number = 50): { x: number; y: number }[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = range / (points - 1);
  const result: { x: number; y: number }[] = [];

  for (let i = 0; i < points; i++) {
    const x = min + i * step;
    let density = 0;
    for (const d of data) {
      const z = (x - d) / bandwidth;
      density += Math.exp(-0.5 * z * z) / (bandwidth * Math.sqrt(2 * Math.PI));
    }
    density /= data.length;
    result.push({ x, y: density });
  }

  return result;
}

function computeBandwidth(data: number[]): number {
  if (data.length < 2) return 1;
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const std = Math.sqrt(data.reduce((sum, d) => sum + (d - data.reduce((a, b) => a + b, 0) / n) ** 2, 0) / n);
  return 0.9 * Math.min(std, iqr / 1.34) * Math.pow(n, -0.2) || 1;
}

interface ViolinChartProps {
  data: TimeDistribution[];
  height?: number;
}

const COLORS = [
  '#BFEFF0',     // Sin iniciar - muted teal
  '#4F46E5',     // En proceso - indigo
  '#6366F1',     // En pausa - indigo light
  '#FBBF24',     // En revisión - yellow
  '#FCD34D',     // Ajustes - yellow light
  '#0DD9D0',     // Finalizado - teal
];

export default function ViolinChart({ data, height = 320 }: ViolinChartProps) {
  const violins = useMemo(() => {
    return data
      .filter(d => d.durations_hours.length > 1)
      .map((d, idx) => {
        const bw = computeBandwidth(d.durations_hours);
        const density = kernelDensity(d.durations_hours, bw, 40);
        const maxDensity = Math.max(...density.map(p => p.y));
        return {
          ...d,
          density,
          maxDensity,
          color: COLORS[d.display_order] || COLORS[idx % COLORS.length],
        };
      });
  }, [data]);

  if (violins.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No hay suficientes datos de tiempo para generar distribuciones
      </div>
    );
  }

  // Chart dimensions
  const padding = { top: 30, right: 20, bottom: 50, left: 60 };
  const chartWidth = 100; // percentage based
  const innerHeight = height - padding.top - padding.bottom;

  // Global Y scale (hours)
  const allHours = violins.flatMap(v => v.durations_hours);
  const maxHours = Math.max(...allHours);
  const yScale = (val: number) => innerHeight - (val / (maxHours || 1)) * innerHeight;

  // Violin width per category
  const violinWidth = Math.min(80, 600 / violins.length);
  const totalWidth = violins.length * (violinWidth + 30) + padding.left + padding.right;

  // Y axis ticks
  const yTicks: number[] = [];
  const yStep = maxHours <= 1 ? 0.25 : maxHours <= 5 ? 1 : maxHours <= 24 ? 4 : Math.ceil(maxHours / 6);
  for (let i = 0; i <= maxHours; i += yStep) {
    yTicks.push(Math.round(i * 100) / 100);
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full"
        style={{ minWidth: totalWidth, maxHeight: height }}
      >
        <defs>
          {violins.map((v, i) => (
            <linearGradient key={`grad-${i}`} id={`violin-grad-${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={v.color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={v.color} stopOpacity={0.15} />
            </linearGradient>
          ))}
        </defs>

        {/* Y axis grid lines */}
        {yTicks.map(tick => (
          <g key={`ytick-${tick}`}>
            <line
              x1={padding.left}
              x2={totalWidth - padding.right}
              y1={padding.top + yScale(tick)}
              y2={padding.top + yScale(tick)}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <text
              x={padding.left - 8}
              y={padding.top + yScale(tick) + 4}
              textAnchor="end"
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              {tick}h
            </text>
          </g>
        ))}

        {/* Violins */}
        {violins.map((v, i) => {
          const cx = padding.left + i * (violinWidth + 30) + violinWidth / 2 + 15;
          const halfWidth = violinWidth / 2;

          // Build violin path
          const points = v.density.map(p => ({
            y: padding.top + yScale(p.x),
            w: (p.y / (v.maxDensity || 1)) * halfWidth,
          }));

          const rightPath = points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${cx + p.w} ${p.y}`).join(' ');
          const leftPath = [...points].reverse().map((p, j) => `${j === 0 ? 'L' : 'L'} ${cx - p.w} ${p.y}`).join(' ');
          const fullPath = `${rightPath} ${leftPath} Z`;

          return (
            <g key={`violin-${i}`}>
              {/* Violin shape */}
              <path
                d={fullPath}
                fill={`url(#violin-grad-${i})`}
                stroke={v.color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />

              {/* Median line */}
              <line
                x1={cx - halfWidth * 0.4}
                x2={cx + halfWidth * 0.4}
                y1={padding.top + yScale(v.stats.median)}
                y2={padding.top + yScale(v.stats.median)}
                stroke={v.color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {/* Q1-Q3 box */}
              <rect
                x={cx - 3}
                y={padding.top + yScale(v.stats.q3)}
                width={6}
                height={Math.max(1, yScale(v.stats.q1) - yScale(v.stats.q3))}
                fill={v.color}
                opacity={0.5}
                rx={2}
              />

              {/* Mean dot */}
              <circle
                cx={cx}
                cy={padding.top + yScale(v.stats.mean)}
                r={3}
                fill="white"
                stroke={v.color}
                strokeWidth={1.5}
              />

              {/* Label */}
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {v.status_name}
              </text>

              {/* Count label */}
              <text
                x={cx}
                y={height - 25}
                textAnchor="middle"
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
                opacity={0.6}
              >
                n={v.count}
              </text>
            </g>
          );
        })}

        {/* Y axis label */}
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          fontSize={11}
          fill="hsl(var(--muted-foreground))"
          transform={`rotate(-90, 15, ${height / 2})`}
        >
          Horas
        </text>
      </svg>
    </div>
  );
}
