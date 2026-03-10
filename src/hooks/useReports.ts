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

export interface MaterialProduction {
  id: string;
  name: string;
  icon: string;
  display_order: number;
  total_required: number;
  total_quantity: number;
  completed_tasks: number;
  in_progress_tasks: number;
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
  estimated_work_days: number;
  estimated_completion_date: string | null;
  utilization_pct: number;
  capacity_gap_hours: number;
  risk_level: 'ok' | 'warning' | 'over';
  risk_label: 'OK' | 'RIESGO' | 'SOBRECARGADO';
  risk_color: 'emerald' | 'amber' | 'red';
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
    weekly_hours_capacity: number;
    utilization_pct: number;
    capacity_gap_hours: number;
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

export function useReportMaterialProduction() {
  return useQuery({
    queryKey: ['report-material-production'],
    queryFn: () => api.get<MaterialProduction[]>('/api/reports/material-production'),
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

export function useReportTeamCapacity() {
  return useQuery({
    queryKey: ['report-team-capacity'],
    queryFn: () => api.get<TeamCapacity>('/api/reports/team-capacity'),
    staleTime: STALE_TIME,
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
