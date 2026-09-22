import { useState } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { useWorkPlanProductionVelocity } from '@/hooks/useWorkPlan';
import type { ProductionMetricKey } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';

const METRICS: { value: ProductionMetricKey; label: string }[] = [
  { value: 'tareas', label: 'Tareas' },
  { value: 'materias', label: 'Materias' },
  { value: 'granulos', label: 'Gránulos' },
  { value: 'materiales', label: 'Materiales' },
];

export function ProductionVelocityChart() {
  const [metric, setMetric] = useState<ProductionMetricKey>('tareas');
  const { data, isLoading } = useWorkPlanProductionVelocity(metric);
  const hasData = (data?.data ?? []).some((s) => s.data.some((p) => p.y > 0));

  return (
    <ChartContainer
      title="Velocidad de producción"
      subtitle={data?.is_approximate ? 'Aproximado — se usa la última edición del registro, no existe fecha de finalización dedicada' : 'Elementos completados por semana'}
      loading={isLoading}
      empty={!isLoading && !hasData}
      minHeight={280}
      actions={
        <div className="flex gap-1 text-[11px]">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`px-2 py-1 rounded-full border transition-colors ${metric === m.value ? 'bg-primary text-white border-primary' : 'text-muted-foreground border-border'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ height: 280 }}>
        <ResponsiveLine
          data={data?.data ?? []}
          margin={{ top: 20, right: 30, bottom: 40, left: 45 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          curve="monotoneX"
          theme={nivoTheme}
          colors={[nivoSeriesColors[0]]}
          pointSize={6}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'seriesColor' }}
          enableArea
          areaOpacity={0.08}
          useMesh
          enableGridX={false}
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          tooltip={({ point }) => (
            <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs">
              <p className="font-semibold">{String(point.data.x)}</p>
              <div className="flex justify-between gap-4"><span>Completados</span><b>{String(point.data.y)}</b></div>
            </div>
          )}
        />
      </div>
    </ChartContainer>
  );
}
