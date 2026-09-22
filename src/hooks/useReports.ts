import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// --- Types ---

export interface ReportOverview {
  projects: { total: number; active: number };
  tasks: {
    total: number;
    by_status: { name: string; color: string; is_completed: boolean; count: number }[];
  };
  materials: { total: number; completed: number; completion_rate: number };
  asignaturas: { total: number; completed: number; completion_rate: number };
  team: { active_members: number };
  avg_completion_seconds: number;
  recent_completed_30d: number;
}

export interface ProjectProgress {
  id: string;
  name: string;
  key: string;
  tipo_programa: string | null;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  in_review_tasks: number;
  adjustment_tasks: number;
  total_materials: number;
  completed_materials: number;
  completion_rate: number;
  overdue_tasks: number;
  due_soon_tasks: number;
}

export interface TeamMember {
  id: string;
  full_name: string;
  cargo: string | null;
  avatar_url: string | null;
  email: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  materials_assigned: number;
  total_horas_estimadas: number;
  total_horas_reales: number;
  completion_rate: number;
}

export interface TimeDistribution {
  status_name: string;
  color: string;
  display_order: number;
  count: number;
  durations_hours: number[];
  stats: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean: number;
  };
}

export interface WorkflowTransition {
  from_status: string;
  from_color: string;
  to_status: string;
  to_color: string;
  count: number;
}

export interface WorkloadByCargo {
  cargo: string;
  team_count: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_horas_estimadas: number;
  completion_rate: number;
}

export interface ProjectCategorySummary {
  category: string;
  total_projects: number;
  total_tasks: number;
}

export interface TasksWeeklyTrendPoint {
  week: string; // ISO date (week start)
  created: number;
  completed: number;
}

export interface ProjectTimeline {
  id: string;
  name: string;
  key: string;
  start_date: string | null;
  target_date: string | null;
  estimated_end_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  estimated_days_remaining: number;
}

export interface TeamMonthlyPoint {
  profile_id: string;
  full_name: string;
  month: string;
  completed_count: number;
}

export interface CapacityMember {
  id: string;
  full_name: string;
  cargo: string | null;
  avatar_url: string | null;
  weekly_hours_capacity: number;
  pending_tasks: number;
  completed_tasks: number;
  tasks_sin_estimacion: number;
  pending_horas: number;
  completed_horas: number;
  horas_sin_fecha: number;
  horas_vencidas: number;
  horas_semana_actual: number;
  carga_semana_actual: number;
  estimated_work_days: number;
  estimated_completion_date: string | null;
  utilization_pct: number;
  holgura_horas: number;
  risk_level: 'available' | 'ok' | 'warning' | 'over';
  risk_label: 'DISPONIBLE' | 'OK' | 'RIESGO' | 'SOBRECARGADO';
  risk_color: 'sky' | 'emerald' | 'amber' | 'red';
}

export interface TeamCapacity {
  schedule: {
    mon_thu_hours: number;
    friday_hours: number;
    weekly_hours: number;
    weekly_hours_default: number;
    avg_daily_hours: number;
  };
  members: CapacityMember[];
}

export interface UserMiniReportTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  due_date: string | null;
  created_at: string;
  status_name: string;
  is_completed: boolean;
  horas_estimadas: number | null;
  project: {
    id: string;
    name: string;
    key: string;
  };
}

export interface UserMiniReportStatusBucket {
  status_name: string;
  is_completed: boolean;
  count: number;
}

export interface UserMiniReport {
  user: {
    id: string;
    full_name: string;
    cargo: string | null;
    avatar_url: string | null;
    email: string;
  };
  summary: {
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    in_review_tasks: number;
    adjustment_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    today_tasks: number;
    tasks_sin_estimacion: number;
    high_priority_tasks: number;
    pending_horas: number;
    completed_horas: number;
    horas_vencidas: number;
    horas_semana_actual: number;
    carga_semana_actual: number;
    weekly_hours_capacity: number;
    utilization_pct: number;
    holgura_horas: number;
  };
  health: {
    status: 'ok' | 'attention' | 'risk' | 'no_load';
    label: 'OK' | 'Atención' | 'Riesgo' | 'Sin carga';
    color: 'emerald' | 'amber' | 'red' | 'slate';
    reasons: string[];
  };
  tasks_by_status: UserMiniReportStatusBucket[];
  top_tasks: UserMiniReportTask[];
}

export interface TeamMemberByCargo {
  id: string;
  full_name: string;
  cargo: string;
  avatar_url: string | null;
  total_tasks: number;
  completed_tasks: number;
  active_tasks: number;
  overdue_tasks: number;
  ajustes_count: number;
  on_time_tasks: number;
  completadas_con_fecha: number;
  is_active: boolean;
  on_time_rate: number | null;
}

export interface WeeklyByCargoPoint {
  week: string;
  cargo: string;
  completed_count: number;
}

export interface UnassignedMaterial {
  id: string;
  cantidad: number;
  material_type: string;
  icon: string;
  tema: string;
  asignatura: string;
  project_name: string;
  project_key: string;
  project_id: string;
}

export interface ContentOverviewByProject {
  id: string;
  name: string;
  programas: number;
  asignaturas: number;
  asignaturas_completadas: number;
  temas: number;
  temas_completados: number;
  materiales: number;
  materiales_completados: number;
}

export interface ContentOverview {
  programas: { total: number };
  temas: { total: number; completed: number; completion_rate: number };
  by_project: ContentOverviewByProject[];
}

// --- Hooks ---

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useReportOverview() {
  return useQuery({
    queryKey: ['report-overview'],
    queryFn: () => api.get<ReportOverview>('/api/reports/overview'),
    staleTime: STALE_TIME,
  });
}

export function useReportProjectsProgress() {
  return useQuery({
    queryKey: ['report-projects-progress'],
    queryFn: () => api.get<ProjectProgress[]>('/api/reports/projects-progress'),
    staleTime: STALE_TIME,
  });
}

export function useReportTeamPerformance() {
  return useQuery({
    queryKey: ['report-team-performance'],
    queryFn: () => api.get<TeamMember[]>('/api/reports/team-performance'),
    staleTime: STALE_TIME,
  });
}

export function useReportTimeDistribution() {
  return useQuery({
    queryKey: ['report-time-distribution'],
    queryFn: () => api.get<TimeDistribution[]>('/api/reports/time-distribution'),
    staleTime: STALE_TIME,
  });
}

export function useReportWorkflowTransitions() {
  return useQuery({
    queryKey: ['report-workflow-transitions'],
    queryFn: () => api.get<WorkflowTransition[]>('/api/reports/workflow-transitions'),
    staleTime: STALE_TIME,
  });
}

export function useReportWorkloadByCargo() {
  return useQuery({
    queryKey: ['report-workload-by-cargo'],
    queryFn: () => api.get<WorkloadByCargo[]>('/api/reports/workload-by-cargo'),
    staleTime: STALE_TIME,
  });
}

export function useReportTeamCapacity(enabled: boolean = true) {
  return useQuery({
    queryKey: ['report-team-capacity'],
    queryFn: () => api.get<TeamCapacity>('/api/reports/team-capacity'),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useUserMiniReport(userId: string | null) {
  return useQuery({
    queryKey: ['report-user-mini', userId],
    queryFn: () => api.get<UserMiniReport>(`/api/reports/user-mini-report/${userId}`),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useReportProjectCategories() {
  return useQuery({
    queryKey: ['report-project-categories'],
    queryFn: () => api.get<ProjectCategorySummary[]>('/api/reports/project-categories'),
    staleTime: STALE_TIME,
  });
}

export function useReportTasksWeeklyTrend() {
  return useQuery({
    queryKey: ['report-tasks-weekly-trend'],
    queryFn: () => api.get<TasksWeeklyTrendPoint[]>('/api/reports/tasks-weekly-trend'),
    staleTime: STALE_TIME,
  });
}

export function useReportProjectsTimeline() {
  return useQuery({
    queryKey: ['report-projects-timeline'],
    queryFn: () => api.get<ProjectTimeline[]>('/api/reports/projects-timeline'),
    staleTime: STALE_TIME,
  });
}

export function useReportTeamMonthlyCompletion() {
  return useQuery({
    queryKey: ['report-team-monthly-completion'],
    queryFn: () => api.get<TeamMonthlyPoint[]>('/api/reports/team-monthly-completion'),
    staleTime: STALE_TIME,
  });
}

export function useReportTeamByCargo() {
  return useQuery({
    queryKey: ['report-team-by-cargo'],
    queryFn: () => api.get<TeamMemberByCargo[]>('/api/reports/team-by-cargo'),
    staleTime: STALE_TIME,
  });
}

export function useReportWeeklyByCargo() {
  return useQuery({
    queryKey: ['report-weekly-by-cargo'],
    queryFn: () => api.get<WeeklyByCargoPoint[]>('/api/reports/weekly-by-cargo'),
    staleTime: STALE_TIME,
  });
}

export function useReportUnassignedMaterials() {
  return useQuery({
    queryKey: ['report-unassigned-materials'],
    queryFn: () => api.get<UnassignedMaterial[]>('/api/reports/unassigned-materials'),
    staleTime: STALE_TIME,
  });
}

// --- Individual Performance ---

export interface IndividualPerformance {
  id: string;
  full_name: string;
  cargo: string | null;
  avatar_url: string | null;
  email: string;
  total_tareas: number;
  tareas_completadas: number;
  tareas_pendientes: number;
  asignaturas_cubiertas: number;
  horas_estimadas_total: number;
  horas_reales_total: number;
  eficiencia_pct: number | null;
  puntualidad_pct: number | null;
}

export interface IndividualPerformanceFilters {
  project_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface PhaseEntry {
  status_name: string;
  status_color: string;
  avg_hours: number;
  median_hours: number;
  sample_count: number;
}

export interface TimeByPhase {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  phases: PhaseEntry[];
}

export function useReportTimeByPhase() {
  return useQuery({
    queryKey: ['report-time-by-phase'],
    queryFn: () => api.get<TimeByPhase[]>('/api/reports/time-by-phase'),
    staleTime: STALE_TIME,
  });
}

export interface TaskDetail {
  id: string;
  title: string;
  assignee_name: string;
  avatar_url: string | null;
  status_name: string;
  status_color: string;
  is_completed: boolean;
  project_name: string;
  project_key: string;
  created_at: string;
  due_date: string | null;
  closed_at: string | null;
  h_espera: number;
  h_proceso: number;
  h_revision: number;
  h_ajustes: number;
  h_total: number;
  devoluciones: number;
}

export function useReportTasksDetail() {
  return useQuery({
    queryKey: ['report-tasks-detail'],
    queryFn: () => api.get<TaskDetail[]>('/api/reports/tasks-detail'),
    staleTime: STALE_TIME,
  });
}

export function useReportIndividualPerformance(filters: IndividualPerformanceFilters = {}) {
  return useQuery({
    queryKey: ['report-individual-performance', filters],
    queryFn: async (): Promise<IndividualPerformance[]> => {
      const params = new URLSearchParams();
      if (filters.project_id) params.set('project_id', filters.project_id);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      const qs = params.toString();
      return await api.get(`/api/reports/individual-performance${qs ? `?${qs}` : ''}`);
    },
    staleTime: STALE_TIME,
  });
}

// --- On-time by equipo ---

export interface OntimeByEquipo {
  cargo: string;
  total_completed: number;
  ontime: number;
  pct: number;
}

export function useReportOntimeByEquipo() {
  return useQuery({
    queryKey: ['report-ontime-by-equipo'],
    queryFn: () => api.get<OntimeByEquipo[]>('/api/reports/ontime-by-equipo'),
    staleTime: STALE_TIME,
  });
}

// --- Reformulated per-person metrics (Resumen/Proyectos/Equipo/Producción/Rendimiento) ---

export interface ReportScopeFilters {
  project_id?: string;
  date_from?: string;
  date_to?: string;
  cargo?: string;
}

function scopeToQuery(filters: ReportScopeFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.project_id) params.set('project_id', filters.project_id);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.cargo) params.set('cargo', filters.cargo);
  return params.toString();
}

export interface PersonMetric {
  id: string;
  full_name: string;
  cargo: string | null;
  avatar_url: string | null;
  email: string;
  unidades_asignadas: number;
  unidades_completadas: number;
  unidades_pendientes: number;
  unidades_vencidas: number;
  unidades_sin_estimacion: number;
  horas_pendientes: number;
  horas_completadas: number;
  proyectos_cubiertos: number;
  entregas_evaluables: number;
  entregas_a_tiempo: number;
  sin_evento_cierre: number;
  puntualidad_pct: number | null;
  cobertura_esfuerzo_pct: number;
  eficiencia_horas_pct: number | null;
}

export interface PersonMetricsResponse {
  people: PersonMetric[];
  overall: {
    entregas_evaluables: number;
    entregas_a_tiempo: number;
    puntualidad_pct: number | null;
  };
}

export function useReportPersonMetrics(filters: ReportScopeFilters = {}) {
  const qs = scopeToQuery(filters);
  return useQuery({
    queryKey: ['report-person-metrics', filters],
    queryFn: () => api.get<PersonMetricsResponse>(`/api/reports/person-metrics${qs ? `?${qs}` : ''}`),
    staleTime: STALE_TIME,
  });
}

export interface CapacityForecastWeek {
  week_start: string;
  horas: number;
  utilizacion_pct: number;
  holgura_horas: number;
  risk_level: 'available' | 'ok' | 'warning' | 'over';
  risk_label: string;
  risk_color: 'sky' | 'emerald' | 'amber' | 'red';
}

export interface CapacityForecastMember {
  id: string;
  full_name: string;
  cargo: string | null;
  avatar_url: string | null;
  weekly_hours_capacity: number;
  current: {
    horas_vencidas: number;
    horas_semana_actual: number;
    carga_semana_actual: number;
    utilizacion_pct: number;
    holgura_horas: number;
    risk_level: 'available' | 'ok' | 'warning' | 'over';
    risk_label: string;
    risk_color: 'sky' | 'emerald' | 'amber' | 'red';
    unidades_semana_actual_sin_estimacion: number;
    carga_semana_actual_aprox: number;
    utilizacion_aprox_pct: number;
    holgura_aprox_horas: number;
  };
  weeks: CapacityForecastWeek[];
  backlog: {
    horas_total: number;
    horas_sin_fecha: number;
    unidades_sin_estimacion: number;
    dias_para_vaciar: number;
    fecha_backlog_vacio: string | null;
  };
}

export interface CapacityForecastResponse {
  schedule: { mon_thu_hours: number; friday_hours: number; weekly_hours: number; avg_daily_hours: number };
  members: CapacityForecastMember[];
  overall: {
    carga_semana_actual: number;
    capacidad_total: number;
    utilizacion_pct: number;
    holgura_horas: number;
    risk_counts: { available: number; ok: number; warning: number; over: number };
    unidades_semana_actual_sin_estimacion: number;
    carga_semana_actual_aprox: number;
    utilizacion_aprox_pct: number;
    holgura_aprox_horas: number;
    avg_horas_asumidas: number;
  };
}

export function useReportCapacityForecast(filters: ReportScopeFilters & { weeks?: number } = {}) {
  const qs = scopeToQuery(filters);
  const params = new URLSearchParams(qs);
  if (filters.weeks) params.set('weeks', String(filters.weeks));
  const finalQs = params.toString();
  return useQuery({
    queryKey: ['report-capacity-forecast', filters],
    queryFn: () => api.get<CapacityForecastResponse>(`/api/reports/capacity-forecast${finalQs ? `?${finalQs}` : ''}`),
    staleTime: STALE_TIME,
  });
}

export interface ThroughputPoint {
  key: string;
  label: string;
  avatar_url: string | null;
  bucket_start: string;
  unidades: number;
  horas: number;
  unidades_sin_estimacion: number;
}

export function useReportThroughput(
  filters: ReportScopeFilters & { bucket?: 'day' | 'week' | 'month'; group_by?: 'person' | 'cargo' } = {}
) {
  const qs = scopeToQuery(filters);
  const params = new URLSearchParams(qs);
  if (filters.bucket) params.set('bucket', filters.bucket);
  if (filters.group_by) params.set('group_by', filters.group_by);
  const finalQs = params.toString();
  return useQuery({
    queryKey: ['report-throughput', filters],
    queryFn: () => api.get<ThroughputPoint[]>(`/api/reports/throughput${finalQs ? `?${finalQs}` : ''}`),
    staleTime: STALE_TIME,
  });
}

export function useReportContentOverview() {
  return useQuery({
    queryKey: ['report-content-overview'],
    queryFn: () => api.get<ContentOverview>('/api/reports/content-overview'),
    staleTime: STALE_TIME,
  });
}

export interface UserLocationRow {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  cargo: string | null;
  project_id: string;
  project_name: string;
  task_count: number;
}

export function useReportUserLocations() {
  return useQuery({
    queryKey: ['report-user-locations'],
    queryFn: () => api.get<UserLocationRow[]>('/api/reports/user-locations'),
    staleTime: STALE_TIME,
  });
}

