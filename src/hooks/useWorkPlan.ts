import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  WorkPlanFilters,
  WorkPlanSummary,
  WorkloadByCollaborator,
  WorkPlanStatus,
  NivoLineSeries,
  PlannedVsCompletedRow,
  StatusByCollaboratorRow,
  CollaboratorProjectMatrix,
  ProductionProgress,
  ProductionVelocity,
  ProductionMetricKey,
  WorkPlanActivity,
  CollaboratorRow,
  CollaboratorDetail,
  WorkPlanAlerts,
  ExecutiveTableResponse,
  WorkPlanFilterOptions,
} from '@/types/workPlan.types';

const STALE_TIME = 60 * 1000; // 1 minute — datos operativos, se refrescan seguido

function toQueryString(filters: WorkPlanFilters, extra?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
  if (extra) Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useWorkPlanFilterOptions() {
  return useQuery({
    queryKey: ['work-plan', 'filters'],
    queryFn: () => api.get<WorkPlanFilterOptions>('/api/reports/work-plan/filters'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkPlanSummary(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'summary', filters],
    queryFn: () => api.get<WorkPlanSummary>(`/api/reports/work-plan/summary${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanWorkload(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'workload', filters],
    queryFn: () => api.get<WorkloadByCollaborator[]>(`/api/reports/work-plan/workload${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanStatusDistribution(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'status-distribution', filters],
    queryFn: () => api.get<WorkPlanStatus>(`/api/reports/work-plan/status-distribution${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanEvolution(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'evolution', filters],
    queryFn: () => api.get<NivoLineSeries[]>(`/api/reports/work-plan/evolution${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanPlannedVsCompleted(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'planned-vs-completed', filters],
    queryFn: () => api.get<PlannedVsCompletedRow[]>(`/api/reports/work-plan/planned-vs-completed${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanStatusByCollaborator(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'status-by-collaborator', filters],
    queryFn: () => api.get<StatusByCollaboratorRow[]>(`/api/reports/work-plan/status-by-collaborator${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanMatrix(filters: WorkPlanFilters, dimension: 'project' | 'materia' = 'project') {
  return useQuery({
    queryKey: ['work-plan', 'matrix', filters, dimension],
    queryFn: () => api.get<CollaboratorProjectMatrix>(
      `/api/reports/work-plan/collaborator-project-matrix${toQueryString(filters, { dimension })}`
    ),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanProductionProgress(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'production-progress', filters],
    queryFn: () => api.get<ProductionProgress>(`/api/reports/work-plan/production-progress${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanProductionVelocity(metric: ProductionMetricKey) {
  return useQuery({
    queryKey: ['work-plan', 'production-velocity', metric],
    queryFn: () => api.get<ProductionVelocity>(`/api/reports/work-plan/production-velocity?metric=${metric}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanActivity() {
  return useQuery({
    queryKey: ['work-plan', 'activity'],
    queryFn: () => api.get<WorkPlanActivity>('/api/reports/work-plan/activity'),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanCollaboratorRows(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'collaborators', filters],
    queryFn: () => api.get<CollaboratorRow[]>(`/api/reports/work-plan/collaborators${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanCollaboratorDetail(collaboratorId: string | null) {
  return useQuery({
    queryKey: ['work-plan', 'collaborator', collaboratorId],
    queryFn: () => api.get<CollaboratorDetail>(`/api/reports/work-plan/collaborator/${collaboratorId}`),
    enabled: !!collaboratorId,
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanAlerts(filters: WorkPlanFilters) {
  return useQuery({
    queryKey: ['work-plan', 'alerts', filters],
    queryFn: () => api.get<WorkPlanAlerts>(`/api/reports/work-plan/alerts${toQueryString(filters)}`),
    staleTime: STALE_TIME,
  });
}

export function useWorkPlanTable(filters: WorkPlanFilters, search: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['work-plan', 'table', filters, search, page, pageSize],
    queryFn: () => api.get<ExecutiveTableResponse>(
      `/api/reports/work-plan/table${toQueryString(filters, { search, page, page_size: pageSize })}`
    ),
    staleTime: STALE_TIME,
  });
}
