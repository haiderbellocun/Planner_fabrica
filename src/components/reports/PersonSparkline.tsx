import React from 'react';
import { CHART_COLORS } from './ReportCharts';

export interface PersonSparklinePoint {
  month: string;
  completed_count: number;
}

export function PersonSparkline({ data, color }: { data: PersonSparklinePoint[]; color?: string }) {
  if (!data || data.length === 0) return null;

  const points = data;
  const max = Math.max(...points.map(p => p.completed_count), 1);
  const min = Math.min(...points.map(p => p.completed_count), 0);
  const span = Math.max(max - min, 1);

  const stepX = points.length > 1 ? 80 / (points.length - 1) : 0;

  const polyPoints = points
    .map((p, idx) => {
      const x = stepX * idx;
      const y = 24 - ((p.completed_count - min) / span) * 20 - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const lastIdx = points.length - 1;
  const lastX = stepX * lastIdx;
  const lastY = 24 - ((points[lastIdx].completed_count - min) / span) * 20 - 2;

  const stroke = color || CHART_COLORS.teal;

  return (
    <svg viewBox="0 0 80 24" preserveAspectRatio="none" width="80" height="24" className="shrink-0">
      <polyline
        points={polyPoints}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}

