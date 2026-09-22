import { useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { StatusByCollaboratorRow } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';

const KEYS = ['sin_iniciar', 'en_proceso', 'en_pausa', 'en_revision', 'ajustes', 'completado'] as const;
const LABELS: Record<(typeof KEYS)[number], string> = {
  sin_iniciar: 'Sin iniciar', en_proceso: 'En proceso', en_pausa: 'En pausa',
  en_revision: 'En revisión', ajustes: 'Ajustes', completado: 'Completado',
};

export function CollaboratorStatusChart({ data, loading }: { data: StatusByCollaboratorRow[] | undefined; loading: boolean }) {
  const [mode, setMode] = useState<'cantidad' | 'porcentaje'>('cantidad');
  const rows = (data ?? []).slice(0, 15);

  const chartData = rows.map((r) => {
    const total = KEYS.reduce((s, k) => s + r[k], 0) || 1;
    const base: Record<string, string | number> = { name: r.full_name.split(/\s+/).slice(0, 2).join(' ') };
    KEYS.forEach((k) => { base[LABELS[k]] = mode === 'porcentaje' ? Math.round((r[k] / total) * 1000) / 10 : r[k]; });
    return base;
  });

  return (
    <ChartContainer
      title="Distribución de estados por colaborador"
      subtitle="En qué fase está el trabajo de cada persona"
      loading={loading}
      empty={!loading && chartData.length === 0}
      minHeight={Math.max(300, chartData.length * 34)}
      actions={
        <div className="flex gap-1 text-[11px]">
          {(['cantidad', 'porcentaje'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 rounded-full border capitalize transition-colors ${mode === m ? 'bg-primary text-white border-primary' : 'text-muted-foreground border-border'}`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ height: Math.max(300, chartData.length * 34) }}>
        <ResponsiveBar
          data={chartData}
          keys={KEYS.map((k) => LABELS[k])}
          indexBy="name"
          layout="horizontal"
          groupMode="stacked"
          margin={{ top: 10, right: 24, bottom: 30, left: 110 }}
          padding={0.3}
          colors={nivoSeriesColors}
          theme={nivoTheme}
          axisBottom={{ tickSize: 0, tickPadding: 6, format: (v) => (mode === 'porcentaje' ? `${v}%` : `${v}`) }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          enableGridY={false}
          enableLabel={false}
          legends={[{
            dataFrom: 'keys',
            anchor: 'bottom',
            direction: 'row',
            translateY: 26,
            itemWidth: 80,
            itemHeight: 14,
            symbolSize: 8,
            symbolShape: 'circle',
          }]}
          tooltip={({ id, value, indexValue }) => (
            <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs min-w-[150px]">
              <p className="font-semibold mb-1">{String(indexValue)}</p>
              <div className="flex justify-between gap-4"><span>{String(id)}</span><b>{value}{mode === 'porcentaje' ? '%' : ''}</b></div>
            </div>
          )}
        />
      </div>
    </ChartContainer>
  );
}
