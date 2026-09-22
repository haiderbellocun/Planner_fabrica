import type { WorkPlanAlerts as WorkPlanAlertsType } from '@/types/workPlan.types';
import { AlertTriangle, UserX, Clock, FolderX, TrendingDown, Flame, CalendarClock } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface AlertDef {
  key: string;
  icon: typeof AlertTriangle;
  label: (count: number) => string;
  count: number;
}

export function WorkPlanAlerts({ data, loading }: { data: WorkPlanAlertsType | undefined; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  const alerts: AlertDef[] = [
    { key: 'overdue', icon: AlertTriangle, label: (n) => `${n} tareas vencidas`, count: data.overdue.count },
    { key: 'no_movement', icon: Clock, label: (n) => `${n} tareas sin movimiento > 5 días`, count: data.no_movement_5d.count },
    { key: 'no_assignee', icon: UserX, label: (n) => `${n} tareas sin responsable`, count: data.no_assignee.count },
    { key: 'inactive_projects', icon: FolderX, label: (n) => `${n} proyectos activos sin actividad en 14 días`, count: data.inactive_projects.count },
    { key: 'low_progress', icon: TrendingDown, label: (n) => `${n} materias con poco avance (≥3 gránulos, <10% completado)`, count: data.low_progress_materias.count },
    { key: 'due_soon', icon: CalendarClock, label: (n) => `${n} tareas vencen en los próximos 3 días`, count: data.due_soon.count },
  ].filter((a) => a.count > 0);

  if (alerts.length === 0 && data.high_concentration.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sin alertas — todo dentro de rangos normales.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {alerts.map((a) => (
        <div key={a.key} className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <a.icon className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-xs text-red-900 font-medium">{a.label(a.count)}</span>
        </div>
      ))}
      {data.high_concentration.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 sm:col-span-2">
          <Flame className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-900 font-medium">
            Alta concentración de tareas en: {data.high_concentration.map((c) => `${c.full_name} (${c.active_tasks})`).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
