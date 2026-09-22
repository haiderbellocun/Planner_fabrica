import { useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { PlannedVsCompletedRow } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';

type SortKey = 'volumen' | 'planificadas' | 'completadas' | 'cumplimiento';

export function PlannedVsCompletedChart({ data, loading }: { data: PlannedVsCompletedRow[] | undefined; loading: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>('volumen');

  const rows = [...(data ?? [])].sort((a, b) => {
    if (sortKey === 'planificadas') return b.planificadas - a.planificadas;
    if (sortKey === 'completadas') return b.completadas - a.completadas;
    if (sortKey === 'cumplimiento') return b.cumplimiento_pct - a.cumplimiento_pct;
    return (b.planificadas + b.completadas) - (a.planificadas + a.completadas);
  }).slice(0, 15);

  const chartData = rows.map((r) => ({
    name: r.full_name.split(/\s+/).slice(0, 2).join(' '),
    Planificado: r.planificadas,
    Completado: r.completadas,
  }));
  const rowByName = new Map(rows.map((r) => [r.full_name.split(/\s+/).slice(0, 2).join(' '), r]));

  const horizontal = chartData.length > 8;

  return (
    <ChartContainer
      title="Planificado vs. completado por colaborador"
      loading={loading}
      empty={!loading && chartData.length === 0}
      minHeight={horizontal ? Math.max(300, chartData.length * 36) : 320}
      actions={
        <div className="flex gap-1 text-[11px]">
          {([
            ['volumen', 'Volumen'], ['planificadas', 'Planificadas'], ['completadas', 'Completadas'], ['cumplimiento', '% Cumplimiento'],
          ] as [SortKey, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded-full border transition-colors ${sortKey === k ? 'bg-primary text-white border-primary' : 'text-muted-foreground border-border'}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ height: horizontal ? Math.max(300, chartData.length * 36) : 320 }}>
        <ResponsiveBar
          data={chartData}
          keys={['Planificado', 'Completado']}
          indexBy="name"
          layout={horizontal ? 'horizontal' : 'vertical'}
          groupMode="grouped"
          margin={horizontal ? { top: 10, right: 24, bottom: 30, left: 110 } : { top: 20, right: 20, bottom: 50, left: 40 }}
          padding={0.3}
          innerPadding={2}
          colors={[nivoSeriesColors[3], nivoSeriesColors[0]]}
          borderRadius={4}
          theme={nivoTheme}
          axisBottom={{ tickSize: 0, tickPadding: 6 }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          enableGridY={!horizontal}
          enableGridX={horizontal}
          enableLabel={false}
          legends={[{
            dataFrom: 'keys',
            anchor: 'top-right',
            direction: 'row',
            translateY: -18,
            itemWidth: 90,
            itemHeight: 14,
            symbolSize: 8,
            symbolShape: 'circle',
          }]}
          tooltip={({ id, value, indexValue }) => {
            const row = rowByName.get(String(indexValue));
            if (!row) return null;
            return (
              <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs min-w-[160px]">
                <p className="font-semibold mb-1">{String(indexValue)}</p>
                <div className="flex justify-between gap-4"><span>{String(id)}</span><b>{value}</b></div>
                <div className="flex justify-between gap-4"><span>% cumplimiento</span><b>{row.cumplimiento_pct}%</b></div>
              </div>
            );
          }}
        />
      </div>
    </ChartContainer>
  );
}
