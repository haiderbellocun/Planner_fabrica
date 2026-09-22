// Tipos del módulo "Plan de Trabajo" — ver server/src/controllers/workPlanController.ts
// para la forma exacta que produce cada endpoint.

export interface WorkPlanFilters {
  project_id?: string;
  team_id?: string;
  cargo?: string;
  assignee_id?: string;
  status_id?: string;
  priority?: string;
  sprint_id?: string;
  programa_id?: string;
  date_from?: string;
  date_to?: string;
}

export type PeriodKey = 'hoy' | 'semana' | 'mes' | 'sprint' | 'personalizado' | 'todo';

export interface WorkPlanSummary {
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  active_collaborators: number;
  progress_pct: number;
  pending_load: number;
  completed_comparison: { current: number; previous: number } | null;
}

export interface WorkloadByCollaborator {
  collaborator_id: string;
  full_name: string;
  avatar_url: string | null;
  cargo: string | null;
  active_tasks: number;
  sin_iniciar: number;
  en_proceso: number;
  en_revision: number;
  vencidas: number;
  carga_ponderada: number;
}

export interface WorkPlanStatus {
  statuses: { id: string; name: string; color: string; count: number }[];
  total: number;
}

export interface NivoLinePoint { x: string; y: number }
export interface NivoLineSeries { id: string; data: NivoLinePoint[] }

export interface PlannedVsCompletedRow {
  collaborator_id: string;
  full_name: string;
  planificadas: number;
  completadas: number;
  cumplimiento_pct: number;
}

export interface StatusByCollaboratorRow {
  collaborator_id: string;
  full_name: string;
  sin_iniciar: number;
  en_proceso: number;
  en_pausa: number;
  en_revision: number;
  ajustes: number;
  completado: number;
}

export interface CollaboratorProjectMatrix {
  rows: { id: string; data: { x: string; y: number; en_proceso: number; vencidas: number }[] }[];
  total_projects: number;
  shown_projects: number;
  dimension: 'project' | 'materia';
}

export interface ProductionMetricProgress {
  total: number;
  completed: number;
  pending: number;
  progress_pct: number;
}

export interface ProductionProgress {
  programas: ProductionMetricProgress;
  materias: ProductionMetricProgress;
  granulos: ProductionMetricProgress;
  materiales: ProductionMetricProgress;
}

export type ProductionMetricKey = 'tareas' | 'materias' | 'granulos' | 'materiales';

export interface ProductionVelocity {
  metric: ProductionMetricKey;
  is_approximate: boolean;
  data: NivoLineSeries[];
}

export interface ActivityFeedItem {
  id: string;
  started_at: string;
  full_name: string;
  task_id: string;
  title: string;
  from_status: string | null;
  to_status: string;
}

export interface WorkPlanActivity {
  last_24h: number;
  last_7d: number;
  daily: NivoLineSeries[];
  feed: ActivityFeedItem[];
}

export interface CollaboratorRow {
  collaborator_id: string;
  full_name: string;
  avatar_url: string | null;
  cargo: string | null;
  total_tasks: number;
  completadas: number;
  en_proceso: number;
  en_revision: number;
  vencidas: number;
  programas_count: number;
  materias_count: number;
  progress_pct: number;
  last_activity: string | null;
}

export interface CollaboratorDetailTask {
  id: string;
  title: string;
  priority: string;
  status_name: string;
  status_color: string;
  project_name: string;
  programa_name: string | null;
  materia_name: string | null;
  granulo_name: string | null;
  sprint_name: string | null;
  due_date: string | null;
  updated_at: string;
}

export interface CollaboratorDetail {
  profile: { id: string; full_name: string; avatar_url: string | null; cargo: string | null; email: string; team_id: string | null; team_name: string | null };
  kpis: { asignadas: number; en_proceso: number; completadas: number; vencidas: number; progress_pct: number };
  evolution: NivoLineSeries[];
  status_distribution: { name: string; color: string; count: number }[];
  tasks: CollaboratorDetailTask[];
}

export interface WorkPlanAlerts {
  overdue: { count: number };
  no_assignee: { count: number };
  no_movement_5d: { count: number };
  inactive_projects: { count: number };
  low_progress_materias: { count: number };
  high_concentration: { full_name: string; active_tasks: number }[];
  due_soon: { count: number };
}

export interface ExecutiveTableRow {
  collaborator_id: string;
  full_name: string;
  cargo: string | null;
  team_name: string | null;
  planificadas: number;
  sin_iniciar: number;
  en_proceso: number;
  en_revision: number;
  completadas: number;
  vencidas: number;
  cumplimiento_pct: number;
  last_activity: string | null;
}

export interface ExecutiveTableResponse {
  rows: ExecutiveTableRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkPlanFilterOptions {
  projects: { id: string; name: string }[];
  teams: { id: string; name: string; project_id: string }[];
  cargos: string[];
  sprints: { id: string; name: string; project_id: string; status: string }[];
  programas: { id: string; name: string; project_id: string }[];
  statuses: { id: string; name: string; color: string }[];
  priorities: string[];
}
