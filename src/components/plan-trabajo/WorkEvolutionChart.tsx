import { ResponsiveLine } from '@nivo/line';
import type { NivoLineSeries } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';

export function WorkEvolutionChart({ data, loading }: { data: NivoLineSeries[] | undefined; loading: boolean }) {
  const hasData = (data ?? []).some((s) => s.data.some((p) => p.y > 0));

  return (
    <ChartContainer
      title="Evolución del plan de trabajo"
      subtitle="Planificadas vs. completadas, últimas 2 semanas"
      loading={loading}
      empty={!loading && !hasData}
      minHeight={320}
    >
      <div style={{ height: 320 }}>
        <ResponsiveLine
          data={data ?? []}
          margin={{ top: 30, right: 30, bottom: 50, left: 50 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false, reverse: false }}
          curve="monotoneX"
          theme={nivoTheme}
          colors={[nivoSeriesColors[2], nivoSeriesColors[0]]}
          pointSize={7}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'seriesColor' }}
          enableTouchCrosshair
          useMesh
          enableGridX={false}
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          legends={[{
            anchor: 'top-right',
            direction: 'row',
            translateY: -24,
            itemWidth: 100,
            itemHeight: 14,
            symbolSize: 8,
            symbolShape: 'circle',
          }]}
          tooltip={({ point }) => {
            const planificadas = data?.[0]?.data.find((p) => p.x === point.data.x)?.y ?? 0;
            const completadas = data?.[1]?.data.find((p) => p.x === point.data.x)?.y ?? 0;
            const diff = planificadas - completadas;
            const pct = planificadas > 0 ? Math.round((completadas / planificadas) * 1000) / 10 : 0;
            return (
              <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs min-w-[170px] space-y-0.5">
                <p className="font-semibold mb-1">{String(point.data.x)}</p>
                <div className="flex justify-between gap-4"><span>Planificadas</span><b>{planificadas}</b></div>
                <div className="flex justify-between gap-4"><span>Completadas</span><b>{completadas}</b></div>
                <div className="flex justify-between gap-4"><span>Diferencia</span><b>{diff}</b></div>
                <div className="flex justify-between gap-4"><span>% cumplimiento</span><b>{pct}%</b></div>
              </div>
            );
          }}
        />
      </div>
    </ChartContainer>
  );
}
