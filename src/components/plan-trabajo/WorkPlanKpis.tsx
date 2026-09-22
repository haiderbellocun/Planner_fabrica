import type { WorkPlanSummary } from '@/types/workPlan.types';
import { formatNumber, formatPercent } from '@/lib/workPlanFormat';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function KpiTile({ label, value, context, comparison }: { label: string; value: string; context?: string; comparison?: { current: number; previous: number } | null }) {
  const delta = comparison ? comparison.current - comparison.previous : null;
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</span>
      <span className="text-2xl font-bold tabular-nums leading-tight">{value}</span>
      {context && <span className="text-[11px] text-muted-foreground">{context}</span>}
      {delta !== null && delta !== 0 && (
        <span className={cn('text-[11px] font-medium flex items-center gap-0.5', delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
          {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(delta)} respecto al periodo anterior
        </span>
      )}
    </div>
  );
}

export function WorkPlanKpis({ summary, loading }: { summary: WorkPlanSummary | undefined; loading: boolean }) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiTile label="Tareas activas" value={formatNumber(summary.active_tasks)} />
      <KpiTile
        label="Completadas"
        value={formatNumber(summary.completed_tasks)}
        comparison={summary.completed_comparison}
      />
      <KpiTile
        label="Vencidas"
        value={formatNumber(summary.overdue_tasks)}
        context={summary.overdue_tasks > 0 ? 'requieren atención' : 'al día'}
      />
      <KpiTile label="Colaboradores activos" value={formatNumber(summary.active_collaborators)} />
      <KpiTile label="Avance general" value={formatPercent(summary.progress_pct)} context="completado / total" />
      <KpiTile label="Carga pendiente" value={formatNumber(summary.pending_load)} context="tareas sin finalizar" />
    </div>
  );
}
