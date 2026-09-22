import { ResponsiveBar } from '@nivo/bar';
import type { ProductionProgress as ProductionProgressType, ProductionMetricProgress } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';
import { formatNumber, formatPercent } from '@/lib/workPlanFormat';

const LABELS: Record<keyof ProductionProgressType, string> = {
  programas: 'Programas', materias: 'Materias', granulos: 'Gránulos', materiales: 'Materiales',
};

function MetricBar({ label, metric }: { label: string; metric: ProductionMetricProgress }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatNumber(metric.completed)} de {formatNumber(metric.total)} · {formatPercent(metric.progress_pct)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, metric.progress_pct)}%` }} />
      </div>
    </div>
  );
}

export function ProductionProgress({ data, loading }: { data: ProductionProgressType | undefined; loading: boolean }) {
  const keys = (Object.keys(LABELS) as (keyof ProductionProgressType)[]);
  const chartData = data ? keys.map((k) => ({
    name: LABELS[k],
    Completados: data[k].completed,
    Pendientes: data[k].pending,
  })) : [];

  return (
    <ChartContainer
      title="Avance de producción"
      subtitle="Programas, materias, gránulos y materiales"
      loading={loading}
      empty={!loading && !data}
      minHeight={320}
    >
      <div className="space-y-4">
        {data && keys.map((k) => <MetricBar key={k} label={LABELS[k]} metric={data[k]} />)}

        <div style={{ height: 160 }} className="pt-2">
          <ResponsiveBar
            data={chartData}
            keys={['Completados', 'Pendientes']}
            indexBy="name"
            layout="horizontal"
            groupMode="stacked"
            margin={{ top: 4, right: 24, bottom: 24, left: 90 }}
            padding={0.35}
            colors={[nivoSeriesColors[0], nivoSeriesColors[3]]}
            theme={nivoTheme}
            axisBottom={{ tickSize: 0, tickPadding: 6 }}
            axisLeft={{ tickSize: 0, tickPadding: 8 }}
            enableGridY={false}
            enableLabel={false}
            legends={[{
              dataFrom: 'keys', anchor: 'bottom', direction: 'row', translateY: 24,
              itemWidth: 90, itemHeight: 12, symbolSize: 8, symbolShape: 'circle',
            }]}
            tooltip={({ id, value, indexValue }) => (
              <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs">
                <p className="font-semibold mb-1">{String(indexValue)}</p>
                <div className="flex justify-between gap-4"><span>{String(id)}</span><b>{value}</b></div>
              </div>
            )}
          />
        </div>
      </div>
    </ChartContainer>
  );
}
