import { useState } from 'react';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import type { ComputedCell } from '@nivo/heatmap';
import type { WorkPlanFilters } from '@/types/workPlan.types';
import { useWorkPlanMatrix } from '@/hooks/useWorkPlan';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, NIVO_TEAL_SCALE } from '@/components/charts/nivoTheme';

type MatrixDatum = { x: string; y: number; en_proceso: number; vencidas: number };
type MatrixCell = ComputedCell<MatrixDatum>;
type Dimension = 'project' | 'materia';

interface ProjectHeatMapProps {
  filters: WorkPlanFilters;
}

/** Colaborador × Proyecto, o Colaborador × Materia — para responder "¿en qué
 * materias interviene tal cargo/persona?" combinado con el filtro de Cargo. */
export function ProjectHeatMap({ filters }: ProjectHeatMapProps) {
  const [dimension, setDimension] = useState<Dimension>('project');
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useWorkPlanMatrix(filters, dimension);

  const rows = data?.rows ?? [];
  const visibleRows = expanded ? rows : rows.slice(0, 12);
  const maxVal = Math.max(1, ...rows.flatMap((r) => r.data.map((d) => d.y)));

  return (
    <ChartContainer
      title={`Matriz colaborador × ${dimension === 'project' ? 'proyecto' : 'materia'}`}
      subtitle={data ? `Top ${data.shown_projects} de ${data.total_projects} por volumen${dimension === 'materia' ? ' · solo tareas vinculadas a una materia' : ''}` : undefined}
      loading={isLoading}
      empty={!isLoading && rows.length === 0}
      emptyMessage={dimension === 'materia' ? 'Ninguna tarea en este filtro está vinculada a una materia todavía' : undefined}
      minHeight={Math.max(320, visibleRows.length * 32)}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 text-[11px]">
            {(['project', 'materia'] as Dimension[]).map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`px-2 py-1 rounded-full border transition-colors ${dimension === d ? 'bg-primary text-white border-primary' : 'text-muted-foreground border-border'}`}
              >
                {d === 'project' ? 'Por proyecto' : 'Por materia'}
              </button>
            ))}
          </div>
          {rows.length > 12 && (
            <button onClick={() => setExpanded((v) => !v)} className="text-[11px] text-primary hover:underline">
              {expanded ? 'Ver menos' : 'Ver matriz completa'}
            </button>
          )}
        </div>
      }
    >
      <div style={{ height: Math.max(320, visibleRows.length * 32) }}>
        <ResponsiveHeatMap
          data={visibleRows}
          margin={{ top: 60, right: 20, bottom: 20, left: 130 }}
          valueFormat=">-.0f"
          colors={{ type: 'sequential', colors: [NIVO_TEAL_SCALE[0], NIVO_TEAL_SCALE[NIVO_TEAL_SCALE.length - 1]], minValue: 0, maxValue: maxVal }}
          emptyColor="#F4FAF9"
          theme={nivoTheme}
          axisTop={{ tickSize: 0, tickPadding: 8, tickRotation: -35 }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          borderRadius={3}
          borderWidth={2}
          borderColor="#ffffff"
          labelTextColor={(cell: MatrixCell) => (cell.value && cell.value > maxVal * 0.55 ? '#ffffff' : '#1f2937')}
          tooltip={({ cell }: { cell: MatrixCell }) => (
            <div className="rounded-lg bg-white border shadow-md px-3 py-2 text-xs min-w-[170px] space-y-0.5">
              <p className="font-semibold">{String(cell.serieId)}</p>
              <p className="text-muted-foreground mb-1">{String(cell.data.x)}</p>
              <div className="flex justify-between gap-4"><span>Tareas activas</span><b>{cell.data.y}</b></div>
              <div className="flex justify-between gap-4"><span>En proceso</span><b>{cell.data.en_proceso ?? 0}</b></div>
              <div className="flex justify-between gap-4"><span>Vencidas</span><b>{cell.data.vencidas ?? 0}</b></div>
            </div>
          )}
        />
      </div>
    </ChartContainer>
  );
}
