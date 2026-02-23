import { useMemo, useState } from 'react';

interface PolarAreaDataItem {
  name: string;
  value: number;
  color: string;
}

interface PolarAreaChartProps {
  data: PolarAreaDataItem[];
  height?: number;
}

const RADIAN = Math.PI / 180;

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg - 90) * RADIAN;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function PolarAreaChart({ data, height = 320 }: PolarAreaChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return { slices: [], gridCircles: [], maxValue: 0 };

    const maxValue = Math.max(...data.map(d => d.value));
    const angleStep = 360 / data.length;

    const slices = data.map((d, i) => {
      const startAngle = i * angleStep;
      const endAngle = (i + 1) * angleStep;
      const radius = maxValue > 0 ? (d.value / maxValue) : 0;
      const midAngle = startAngle + angleStep / 2;
      return { ...d, startAngle, endAngle, radius, midAngle, index: i };
    });

    // Grid circles (3-4 concentric)
    const step = maxValue <= 4 ? 1 : Math.ceil(maxValue / 4);
    const gridCircles: number[] = [];
    for (let v = step; v <= maxValue; v += step) {
      gridCircles.push(v);
    }
    if (gridCircles[gridCircles.length - 1] !== maxValue && maxValue > 0) {
      gridCircles.push(maxValue);
    }

    return { slices, gridCircles, maxValue };
  }, [data]);

  if (data.length === 0 || chartData.maxValue === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No hay datos para mostrar
      </div>
    );
  }

  const size = height;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.35;
  const labelRadius = size * 0.43;

  return (
    <div className="w-full flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid circles */}
        {chartData.gridCircles.map(v => {
          const r = (v / chartData.maxValue) * maxRadius;
          return (
            <g key={`grid-${v}`}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
              <text
                x={cx + 4}
                y={cy - r + 12}
                fontSize={9}
                fill="hsl(var(--muted-foreground))"
                opacity={0.6}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Angle grid lines */}
        {chartData.slices.map((s, i) => {
          const p = polarToCartesian(cx, cy, maxRadius, s.startAngle);
          return (
            <line
              key={`line-${i}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          );
        })}

        {/* Slices */}
        {chartData.slices.map((s, i) => {
          const r = s.radius * maxRadius;
          const isHovered = hoveredIndex === i;
          const scale = isHovered ? 1.05 : 1;
          return (
            <g
              key={`slice-${i}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={describeArc(cx, cy, r * scale, s.startAngle, s.endAngle)}
                fill={s.color}
                fillOpacity={isHovered ? 0.85 : 0.7}
                stroke="white"
                strokeWidth={1.5}
                style={{ transition: 'fill-opacity 0.2s, d 0.2s' }}
              />
            </g>
          );
        })}

        {/* Labels outside */}
        {chartData.slices.map((s, i) => {
          const lp = polarToCartesian(cx, cy, labelRadius, s.midAngle);
          const isRight = lp.x >= cx;
          const isBottom = lp.y >= cy;
          let textAnchor: string = 'middle';
          if (Math.abs(lp.x - cx) > 10) {
            textAnchor = isRight ? 'start' : 'end';
          }
          let dy = 0;
          if (Math.abs(lp.y - cy) > 10) {
            dy = isBottom ? 4 : -2;
          }
          return (
            <text
              key={`label-${i}`}
              x={lp.x}
              y={lp.y + dy}
              textAnchor={textAnchor}
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
              fontWeight={hoveredIndex === i ? 600 : 400}
              style={{ transition: 'font-weight 0.2s' }}
            >
              {s.name}
            </text>
          );
        })}

        {/* Tooltip on hover */}
        {hoveredIndex !== null && (() => {
          const s = chartData.slices[hoveredIndex];
          const total = data.reduce((sum, d) => sum + d.value, 0);
          const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0';
          return (
            <g>
              <rect
                x={cx - 45}
                y={cy - 20}
                width={90}
                height={40}
                rx={6}
                fill="hsl(var(--background))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
              />
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
                {s.value}
              </text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
                {pct}%
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
