import { ResponsivePie } from '@nivo/pie';
import type { PieCustomLayerProps } from '@nivo/pie';
import type { WorkPlanStatus } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme } from '@/components/charts/nivoTheme';
import { formatNumber } from '@/lib/workPlanFormat';

type StatusDatum = { id: string; label: string; value: number; color: string };

function CenteredMetric({ dataWithArc, centerX, centerY }: PieCustomLayerProps<StatusDatum>) {
  const total = dataWithArc.reduce((sum, d) => sum + d.value, 0);
  return (
    <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="central">
      <tspan x={centerX} dy="-0.3em" style={{ fontSize: 20, fontWeight: 700, fill: '#1f2937' }}>
        {formatNumber(total)}
      </tspan>
      <tspan x={centerX} dy="1.4em" style={{ fontSize: 10, fill: '#6B7F7C' }}>
        TOTAL
      </tspan>
    </text>
  );
}

export function WorkStatusChart({ data, loading }: { data: WorkPlanStatus | undefined; loading: boolean }) {
  const statuses = (data?.statuses ?? []).filter((s) => s.count > 0);
  const total = data?.total ?? 0;
  const pieData = statuses.map((s) => ({ id: s.name, label: s.name, value: s.count, color: s.color }));

  return (
    <ChartContainer
      title="Estado del trabajo"
      subtitle={`${formatNumber(total)} tareas en el filtro actual`}
      loading={loading}
      empty={!loading && pieData.length === 0}
      minHeight={280}
    >
      <div style={{ height: 280 }}>
        <ResponsivePie
          data={pieData}
          margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
          innerRadius={0.65}
          padAngle={1.5}
          cornerRadius={3}
          colors={{ datum: 'data.color' }}
          theme={nivoTheme}
          enableArcLinkLabels={false}
          arcLabelsSkipAngle={18}
          arcLabelsTextColor="#ffffff"
          legends={[{
            anchor: 'bottom',
            direction: 'row',
            translateY: 36,
            itemWidth: 90,
            itemHeight: 14,
            symbolSize: 8,
            symbolShape: 'circle',
            itemTextColor: '#6B7F7C',
          }]}
          layers={['arcs', 'arcLabels', 'legends', CenteredMetric]}
          tooltip={({ datum }) => (
            <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs min-w-[140px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: datum.color }} />
                <span className="font-semibold">{datum.label}</span>
              </div>
              <div className="flex justify-between gap-4"><span>Cantidad</span><b>{datum.value}</b></div>
              <div className="flex justify-between gap-4"><span>Porcentaje</span><b>{total > 0 ? Math.round((Number(datum.value) / total) * 100) : 0}%</b></div>
            </div>
          )}
        />
      </div>
    </ChartContainer>
  );
}
