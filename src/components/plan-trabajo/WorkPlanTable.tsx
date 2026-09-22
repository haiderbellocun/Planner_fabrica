import { useState } from 'react';
import type { WorkPlanFilters } from '@/types/workPlan.types';
import { useWorkPlanTable } from '@/hooks/useWorkPlan';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/workPlanFormat';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const COLUMNS = [
  { key: 'full_name', label: 'Colaborador' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'team_name', label: 'Equipo' },
  { key: 'planificadas', label: 'Planificadas' },
  { key: 'sin_iniciar', label: 'Sin iniciar' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'en_revision', label: 'Revisión' },
  { key: 'completadas', label: 'Completadas' },
  { key: 'vencidas', label: 'Vencidas' },
  { key: 'cumplimiento_pct', label: '% Cumplimiento' },
  { key: 'last_activity', label: 'Última actividad' },
] as const;

export function WorkPlanTable({ filters, onOpenCollaborator }: { filters: WorkPlanFilters; onOpenCollaborator: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading } = useWorkPlanTable(filters, search, page, pageSize);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar colaborador…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-8 text-xs max-w-xs"
        />
        <span className="text-xs text-muted-foreground">{data?.total ?? 0} colaboradores</span>
      </div>

      <div className="rounded-xl border bg-card overflow-auto max-h-[520px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left font-semibold text-muted-foreground border-b whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={COLUMNS.length} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : data && data.rows.length > 0 ? data.rows.map((r) => (
              <tr
                key={r.collaborator_id}
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onOpenCollaborator(r.collaborator_id)}
              >
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.full_name}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.cargo ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.team_name ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.planificadas}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sin_iniciar}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.en_proceso}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.en_revision}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.completadas}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.vencidas > 0 ? <span className="text-red-600 font-semibold">{r.vencidas}</span> : 0}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.cumplimiento_pct}%</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatRelativeDate(r.last_activity)}</td>
              </tr>
            )) : (
              <tr><td colSpan={COLUMNS.length} className="py-10 text-center text-muted-foreground">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > pageSize && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
