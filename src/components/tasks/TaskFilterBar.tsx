import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Search, X, ChevronDown } from 'lucide-react';
import { useTaskStatuses, useProjectTags } from '@/hooks/useTasks';
import { useProfiles } from '@/hooks/useProfiles';
import { useEpics } from '@/hooks/useEpics';
import { useTeams } from '@/hooks/useTeams';
import { useSprints } from '@/hooks/useSprints';
import { TaskFilters, EMPTY_TASK_FILTERS, hasActiveFilters, countActiveFilters } from '@/lib/taskFilters';

const ALL = '__all__';

const priorityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

interface TaskFilterBarProps {
  projectId: string;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  isDesarrollo?: boolean;
}

export function TaskFilterBar({ projectId, filters, onChange, isDesarrollo }: TaskFilterBarProps) {
  const { data: statuses = [] } = useTaskStatuses();
  const { data: profiles = [] } = useProfiles();
  const { data: tags = [] } = useProjectTags(projectId);
  const { data: epics = [] } = useEpics(projectId);
  const { data: teams = [] } = useTeams(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const [searchInput, setSearchInput] = useState(filters.search ?? '');

  useEffect(() => {
    setSearchInput(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== (filters.search ?? '')) {
        onChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const statusIds = filters.status_id ?? [];
  const priorities = filters.priority ?? [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar tareas..."
            className="pl-8 h-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              Estado {statusIds.length > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{statusIds.length}</Badge>}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Filtrar por estado (varios)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statuses.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.id}
                checked={statusIds.includes(s.id)}
                onCheckedChange={(checked) => {
                  const next = checked ? [...statusIds, s.id] : statusIds.filter((id) => id !== s.id);
                  set('status_id', next.length > 0 ? next : undefined);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              Prioridad {priorities.length > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{priorities.length}</Badge>}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filtrar por prioridad (varias)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(priorityLabels).map(([value, label]) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={priorities.includes(value as NonNullable<TaskFilters['priority']>[number])}
                onCheckedChange={(checked) => {
                  const v = value as NonNullable<TaskFilters['priority']>[number];
                  const next = checked ? [...priorities, v] : priorities.filter((p) => p !== v);
                  set('priority', next.length > 0 ? next : undefined);
                }}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={filters.assignee_id ?? ALL}
          onValueChange={(v) => set('assignee_id', v === ALL ? undefined : v)}
        >
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Responsable" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select value={filters.tag ?? ALL} onValueChange={(v) => set('tag', v === ALL ? undefined : v)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda etiqueta</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isDesarrollo && (
          <>
            <Select value={filters.epic_id ?? ALL} onValueChange={(v) => set('epic_id', v === ALL ? undefined : v)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Épica" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toda épica</SelectItem>
                <SelectItem value="none">Sin épica</SelectItem>
                {epics.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.team_id ?? ALL} onValueChange={(v) => set('team_id', v === ALL ? undefined : v)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Equipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todo equipo</SelectItem>
                <SelectItem value="none">Sin equipo</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.sprint_id ?? ALL} onValueChange={(v) => set('sprint_id', v === ALL ? undefined : v)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Sprint" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todo sprint</SelectItem>
                <SelectItem value="none">Backlog (sin sprint)</SelectItem>
                {sprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(EMPTY_TASK_FILTERS)}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Limpiar filtros ({countActiveFilters(filters)})
          </Button>
        )}
      </div>

      {hasActiveFilters(filters) && (
        <div className="flex flex-wrap gap-1.5">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              "{filters.search}"
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => { setSearchInput(''); set('search', undefined); }}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {statusIds.map((id) => {
            const s = statuses.find((st) => st.id === id);
            if (!s) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {s.name}
                <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => {
                  const next = statusIds.filter((x) => x !== id);
                  set('status_id', next.length > 0 ? next : undefined);
                }}><X className="h-3 w-3" /></button>
              </Badge>
            );
          })}
          {priorities.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1">
              {priorityLabels[p] ?? p}
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => {
                const next = priorities.filter((x) => x !== p);
                set('priority', next.length > 0 ? next : undefined);
              }}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {filters.assignee_id && (
            <Badge variant="secondary" className="gap-1">
              {filters.assignee_id === 'unassigned'
                ? 'Sin asignar'
                : profiles.find((p) => p.id === filters.assignee_id)?.full_name ?? 'Responsable'}
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => set('assignee_id', undefined)}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filters.tag && (
            <Badge variant="secondary" className="gap-1">
              #{filters.tag}
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => set('tag', undefined)}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filters.epic_id && (
            <Badge variant="secondary" className="gap-1">
              {filters.epic_id === 'none' ? 'Sin épica' : epics.find((e) => e.id === filters.epic_id)?.title ?? 'Épica'}
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => set('epic_id', undefined)}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filters.team_id && (
            <Badge variant="secondary" className="gap-1">
              {filters.team_id === 'none' ? 'Sin equipo' : teams.find((t) => t.id === filters.team_id)?.name ?? 'Equipo'}
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => set('team_id', undefined)}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filters.sprint_id && (
            <Badge variant="secondary" className="gap-1">
              {filters.sprint_id === 'none' ? 'Backlog' : sprints.find((s) => s.id === filters.sprint_id)?.name ?? 'Sprint'}
              <button
              className="rounded-full p-0.5 -mr-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              onClick={() => set('sprint_id', undefined)}><X className="h-3 w-3" /></button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
