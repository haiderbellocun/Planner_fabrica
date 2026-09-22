import { useMemo, useState } from 'react';
import type { WorkPlanFilters } from '@/types/workPlan.types';
import {
  WorkPlanFilters as WorkPlanFiltersBar,
  resolvePeriodRange,
  DEFAULT_FILTER_STATE,
  type WorkPlanFilterState,
} from './WorkPlanFilters';
import { WorkPlanKpis } from './WorkPlanKpis';
import { WorkloadChart } from './WorkloadChart';
import { WorkStatusChart } from './WorkStatusChart';
import { WorkEvolutionChart } from './WorkEvolutionChart';
import { PlannedVsCompletedChart } from './PlannedVsCompletedChart';
import { CollaboratorStatusChart } from './CollaboratorStatusChart';
import { ProjectHeatMap } from './ProjectHeatMap';
import { ProductionProgress } from './ProductionProgress';
import { ProductionVelocityChart } from './ProductionVelocityChart';
import { ActivityFeed } from './ActivityFeed';
import { CollaboratorWorkPlanRows } from './CollaboratorWorkPlanRows';
import { CollaboratorDetailDrawer } from './CollaboratorDetailDrawer';
import { WorkPlanAlerts } from './WorkPlanAlerts';
import { WorkPlanTable } from './WorkPlanTable';
import {
  useWorkPlanSummary,
  useWorkPlanWorkload,
  useWorkPlanStatusDistribution,
  useWorkPlanEvolution,
  useWorkPlanPlannedVsCompleted,
  useWorkPlanStatusByCollaborator,
  useWorkPlanProductionProgress,
  useWorkPlanCollaboratorRows,
  useWorkPlanAlerts,
} from '@/hooks/useWorkPlan';
import { useReportOverview, useReportContentOverview } from '@/hooks/useReports';
import { StatTile } from '@/components/shared/StoryUI';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

/** Las mismas 4 tarjetas de Contenido que ya existían en Detalle analítico — todo
 * este módulo se basa en el mismo trabajo de Programas/Materias/Gránulos/Materiales,
 * así que se repiten aquí arriba para que el contexto quede completo de un vistazo. */
function ContentSummaryCards() {
  const { data: overview } = useReportOverview();
  const { data: contentOverview } = useReportContentOverview();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatTile label="Programas" value={contentOverview?.programas.total ?? 0} sub="en total" />
      <StatTile
        label="Materias"
        value={overview?.asignaturas?.total ?? 0}
        sub={`${overview?.asignaturas?.completed ?? 0} completadas (${(overview?.asignaturas?.completion_rate ?? 0).toFixed(2)}%)`}
      />
      <StatTile
        label="Gránulos"
        value={contentOverview?.temas.total ?? 0}
        sub={`${contentOverview?.temas.completed ?? 0} completados (${(contentOverview?.temas.completion_rate ?? 0).toFixed(2)}%)`}
      />
      <StatTile
        label="Materiales"
        value={overview?.materials?.total ?? 0}
        sub={`${overview?.materials?.completed ?? 0} completados (${(overview?.materials?.completion_rate ?? 0).toFixed(2)}%)`}
      />
    </div>
  );
}

export function PlanDeTrabajoTab() {
  const [filterState, setFilterState] = useState<WorkPlanFilterState>(DEFAULT_FILTER_STATE);
  const [openCollaboratorId, setOpenCollaboratorId] = useState<string | null>(null);

  const filters: WorkPlanFilters = useMemo(() => ({
    project_id: filterState.projectId || undefined,
    team_id: filterState.teamId || undefined,
    cargo: filterState.cargo || undefined,
    assignee_id: filterState.assigneeId || undefined,
    status_id: filterState.statusId || undefined,
    priority: filterState.priority || undefined,
    programa_id: filterState.programaId || undefined,
    sprint_id: filterState.period === 'sprint' ? (filterState.sprintId || undefined) : undefined,
    ...resolvePeriodRange(filterState),
  }), [filterState]);

  const summary = useWorkPlanSummary(filters);
  const workload = useWorkPlanWorkload(filters);
  const statusDist = useWorkPlanStatusDistribution(filters);
  const evolution = useWorkPlanEvolution(filters);
  const plannedVsCompleted = useWorkPlanPlannedVsCompleted(filters);
  const statusByCollaborator = useWorkPlanStatusByCollaborator(filters);
  const production = useWorkPlanProductionProgress(filters);
  const collaboratorRows = useWorkPlanCollaboratorRows(filters);
  const alerts = useWorkPlanAlerts(filters);

  const setAssignee = (id: string) => setFilterState((s) => ({ ...s, assigneeId: id }));

  return (
    <div className="space-y-8">
      <WorkPlanFiltersBar value={filterState} onChange={setFilterState} />

      <section>
        <SectionHeader title="Contenido" subtitle="Programas, materias, gránulos y materiales" />
        <ContentSummaryCards />
      </section>

      <section>
        <SectionHeader title="KPI principales" />
        <WorkPlanKpis summary={summary.data} loading={summary.isLoading} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorkloadChart data={workload.data} loading={workload.isLoading} onSelectCollaborator={setAssignee} />
        <WorkStatusChart data={statusDist.data} loading={statusDist.isLoading} />
      </section>

      <section>
        <WorkEvolutionChart data={evolution.data} loading={evolution.isLoading} />
      </section>

      <section>
        <PlannedVsCompletedChart data={plannedVsCompleted.data} loading={plannedVsCompleted.isLoading} />
      </section>

      <section>
        <CollaboratorStatusChart data={statusByCollaborator.data} loading={statusByCollaborator.isLoading} />
      </section>

      <section>
        <ProjectHeatMap filters={filters} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProductionProgress data={production.data} loading={production.isLoading} />
        <ProductionVelocityChart />
      </section>

      <section>
        <ActivityFeed />
      </section>

      <section>
        <SectionHeader title="Plan de trabajo por persona" />
        <CollaboratorWorkPlanRows data={collaboratorRows.data} loading={collaboratorRows.isLoading} onOpen={setOpenCollaboratorId} />
      </section>

      <section>
        <SectionHeader title="Requieren atención" />
        <WorkPlanAlerts data={alerts.data} loading={alerts.isLoading} />
      </section>

      <section>
        <SectionHeader title="Tabla operativa" />
        <WorkPlanTable filters={filters} onOpenCollaborator={setOpenCollaboratorId} />
      </section>

      <CollaboratorDetailDrawer collaboratorId={openCollaboratorId} onOpenChange={(open) => !open && setOpenCollaboratorId(null)} />
    </div>
  );
}
