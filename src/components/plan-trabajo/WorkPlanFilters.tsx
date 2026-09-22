import type { PeriodKey } from '@/types/workPlan.types';
import { useWorkPlanFilterOptions } from '@/hooks/useWorkPlan';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface WorkPlanFilterState {
  period: PeriodKey;
  customFrom: string;
  customTo: string;
  projectId: string;
  teamId: string;
  cargo: string;
  assigneeId: string;
  statusId: string;
  priority: string;
  programaId: string;
  sprintId: string;
}

export const DEFAULT_FILTER_STATE: WorkPlanFilterState = {
  period: 'todo',
  customFrom: '',
  customTo: '',
  projectId: '',
  teamId: '',
  cargo: '',
  assigneeId: '',
  statusId: '',
  priority: '',
  programaId: '',
  sprintId: '',
};

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'todo', label: 'Todo' },
];

const selectClass = 'h-8 text-xs rounded-lg border border-border bg-background px-2.5 focus:outline-none focus:ring-1 focus:ring-primary/40 min-w-[110px]';

export function WorkPlanFilters({
  value,
  onChange,
}: {
  value: WorkPlanFilterState;
  onChange: (next: WorkPlanFilterState) => void;
}) {
  const { data: options } = useWorkPlanFilterOptions();
  const set = <K extends keyof WorkPlanFilterState>(key: K, v: WorkPlanFilterState[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectClass} value={value.period} onChange={(e) => set('period', e.target.value as PeriodKey)}>
        {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      {value.period === 'personalizado' && (
        <>
          <Input type="date" className="h-8 text-xs w-[130px]" value={value.customFrom} onChange={(e) => set('customFrom', e.target.value)} />
          <Input type="date" className="h-8 text-xs w-[130px]" value={value.customTo} onChange={(e) => set('customTo', e.target.value)} />
        </>
      )}

      {value.period === 'sprint' && (
        <select className={selectClass} value={value.sprintId} onChange={(e) => set('sprintId', e.target.value)}>
          <option value="">Selecciona un sprint</option>
          {(options?.sprints ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      <div className="h-4 w-px bg-border" />

      <select className={selectClass} value={value.projectId} onChange={(e) => set('projectId', e.target.value)}>
        <option value="">Todos los proyectos</option>
        {(options?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <select className={selectClass} value={value.teamId} onChange={(e) => set('teamId', e.target.value)}>
        <option value="">Todos los equipos</option>
        {(options?.teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      <select className={selectClass} value={value.cargo} onChange={(e) => set('cargo', e.target.value)}>
        <option value="">Todos los cargos</option>
        {(options?.cargos ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <select className={selectClass} value={value.statusId} onChange={(e) => set('statusId', e.target.value)}>
        <option value="">Todos los estados</option>
        {(options?.statuses ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select className={selectClass} value={value.priority} onChange={(e) => set('priority', e.target.value)}>
        <option value="">Toda prioridad</option>
        {(options?.priorities ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <select className={selectClass} value={value.programaId} onChange={(e) => set('programaId', e.target.value)}>
        <option value="">Todos los programas</option>
        {(options?.programas ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {(value.projectId || value.teamId || value.cargo || value.statusId || value.priority || value.programaId || value.sprintId) && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTER_STATE, period: value.period })}
          className={cn('text-xs text-muted-foreground hover:text-destructive transition-colors')}
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

/** Resuelve el periodo elegido a un rango date_from/date_to concreto (o ninguno). */
export function resolvePeriodRange(state: WorkPlanFilterState): { date_from?: string; date_to?: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();

  if (state.period === 'hoy') return { date_from: iso(today), date_to: iso(today) };

  if (state.period === 'semana') {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { date_from: iso(monday), date_to: iso(sunday) };
  }

  if (state.period === 'mes') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { date_from: iso(first), date_to: iso(last) };
  }

  if (state.period === 'personalizado' && state.customFrom && state.customTo) {
    return { date_from: state.customFrom, date_to: state.customTo };
  }

  return {};
}
