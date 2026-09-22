import { ResponsiveBar } from '@nivo/bar';
import type { WorkloadByCollaborator } from '@/types/workPlan.types';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';

interface WorkloadChartProps {
  data: WorkloadByCollaborator[] | undefined;
  loading: boolean;
  onSelectCollaborator?: (collaboratorId: string) => void;
}

/** Carga activa por colaborador — barra horizontal, altura crece con la cantidad de personas. */
export function WorkloadChart({ data, loading, onSelectCollaborator }: WorkloadChartProps) {
  const rows = (data ?? []).slice(0, 20);
  const chartData = rows.map((r) => ({
    name: r.full_name.split(/\s+/).slice(0, 2).join(' '),
    tareas: r.active_tasks,
  }));
  const rowByName = new Map(rows.map((r) => [r.full_name.split(/\s+/).slice(0, 2).join(' '), r]));

  return (
    <ChartContainer
      title="Carga de trabajo por colaborador"
      subtitle="Tareas activas asignadas ahora mismo"
      loading={loading}
      empty={!loading && chartData.length === 0}
      minHeight={Math.max(280, chartData.length * 34)}
    >
      <div style={{ height: Math.max(280, chartData.length * 34) }}>
        <ResponsiveBar
          data={chartData}
          keys={['tareas']}
          indexBy="name"
          layout="horizontal"
          margin={{ top: 10, right: 24, bottom: 30, left: 130 }}
          padding={0.35}
          colors={nivoSeriesColors[0]}
          borderRadius={4}
          theme={nivoTheme}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          axisBottom={{ tickSize: 0, tickPadding: 6 }}
          enableGridY={false}
          enableLabel
          label={(d) => `${d.value}`}
          labelSkipWidth={16}
          labelTextColor="#ffffff"
          onClick={(d) => {
            const row = rowByName.get(String(d.indexValue));
            if (row) onSelectCollaborator?.(row.collaborator_id);
          }}
          tooltip={({ indexValue }) => {
            const row = rowByName.get(String(indexValue));
            if (!row) return null;
            return (
              <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs space-y-1 min-w-[180px]">
                <p className="font-semibold">{row.full_name}</p>
                {row.cargo && <p className="text-muted-foreground">{row.cargo}</p>}
                <div className="pt-1 space-y-0.5">
                  <div className="flex justify-between gap-4"><span>Tareas activas</span><b>{row.active_tasks}</b></div>
                  <div className="flex justify-between gap-4"><span>Sin iniciar</span><b>{row.sin_iniciar}</b></div>
                  <div className="flex justify-between gap-4"><span>En proceso</span><b>{row.en_proceso}</b></div>
                  <div className="flex justify-between gap-4"><span>En revisión</span><b>{row.en_revision}</b></div>
                  <div className="flex justify-between gap-4"><span>Vencidas</span><b>{row.vencidas}</b></div>
                  <div className="flex justify-between gap-4"><span>Carga ponderada</span><b>{row.carga_ponderada}</b></div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </ChartContainer>
  );
}
