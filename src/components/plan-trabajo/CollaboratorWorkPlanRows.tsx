import type { CollaboratorRow } from '@/types/workPlan.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/workPlanFormat';
import { Loader2 } from 'lucide-react';

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function CollaboratorWorkPlanRows({
  data,
  loading,
  onOpen,
}: {
  data: CollaboratorRow[] | undefined;
  loading: boolean;
  onOpen: (collaboratorId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sin colaboradores con tareas en este filtro</p>;
  }

  return (
    <div className="divide-y divide-border rounded-xl border overflow-hidden bg-card">
      {data.map((c) => (
        <div key={c.collaborator_id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={c.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(c.full_name)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 w-[180px] shrink-0">
            <p className="text-sm font-semibold truncate">{c.full_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{c.cargo ?? '—'}</p>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0 w-[220px]">
            <span>{c.total_tasks} tareas</span>
            <span>{c.programas_count} programas</span>
            <span>{c.materias_count} materias</span>
          </div>

          <div className="flex-1 min-w-[100px]">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, c.progress_pct)}%` }} />
            </div>
          </div>
          <span className="text-xs font-semibold tabular-nums w-10 text-right shrink-0">{Math.round(c.progress_pct)}%</span>

          <div className="flex items-center gap-1.5 shrink-0">
            {c.en_proceso > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">{c.en_proceso} proceso</span>}
            {c.en_revision > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{c.en_revision} revisión</span>}
            {c.vencidas > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{c.vencidas} vencidas</span>}
          </div>

          <div className="text-[11px] text-muted-foreground w-[110px] shrink-0 hidden lg:block">
            {formatRelativeDate(c.last_activity)}
          </div>

          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => onOpen(c.collaborator_id)}>
            Ver plan
          </Button>
        </div>
      ))}
    </div>
  );
}
