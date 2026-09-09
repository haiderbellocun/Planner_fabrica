import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { TaskWithDetails } from '@/hooks/useTasks';
import { TaskBulkActionsBar } from './TaskBulkActionsBar';
import { getBusinessTodayStr, getDueBucket } from '@/lib/dueDate';
import { parseDateOnly } from '@/lib/dates';
import { BADGE_TONES } from '@/lib/badgeColors';

const priorityConfig = {
  low: { label: 'Baja', className: BADGE_TONES.neutral, rank: 0 },
  medium: { label: 'Media', className: BADGE_TONES.warning, rank: 1 },
  high: { label: 'Alta', className: BADGE_TONES.escalated, rank: 2 },
  urgent: { label: 'Urgente', className: BADGE_TONES.danger, rank: 3 },
};

type SortKey = 'task_number' | 'title' | 'status' | 'priority' | 'assignee' | 'due_date' | 'epic' | 'team' | 'sprint';

const getInitials = (name: string | null | undefined) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // nulls last
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es');
}

interface TaskListViewProps {
  tasks: TaskWithDetails[];
  projectKey: string;
  projectId: string;
  onTaskClick: (task: TaskWithDetails) => void;
  isDesarrollo?: boolean;
  isAdminOrLeader?: boolean;
  isLoading?: boolean;
  hasActiveFilters?: boolean;
  filtersKey?: string;
}

export function TaskListView({
  tasks,
  projectKey,
  projectId,
  onTaskClick,
  isDesarrollo,
  isAdminOrLeader,
  isLoading,
  hasActiveFilters,
  filtersKey,
}: TaskListViewProps) {
  const todayStr = getBusinessTodayStr();
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'task_number', dir: 'desc' });
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Selection persists across pages/sorting but resets when the active
  // filters change -- a different filter set reads as a different working
  // set, not a continuation of the same one.
  useEffect(() => {
    setSelected(new Set());
  }, [filtersKey]);

  // Prune ids that fell out of `tasks` (refetch, deletion) without wiping the
  // rest of the selection.
  useEffect(() => {
    setSelected((prev) => {
      const validIds = new Set(tasks.map((t) => t.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [tasks]);

  const sorted = useMemo(() => {
    const list = [...tasks];
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case 'task_number':
          return dirMul * compareValues(a.task_number, b.task_number);
        case 'title':
          return dirMul * compareValues(a.title, b.title);
        case 'status':
          return dirMul * compareValues(a.status?.name, b.status?.name);
        case 'priority':
          return dirMul * compareValues(priorityConfig[a.priority]?.rank, priorityConfig[b.priority]?.rank);
        case 'assignee':
          return dirMul * compareValues(a.assignee?.full_name, b.assignee?.full_name);
        case 'due_date':
          return dirMul * compareValues(a.due_date, b.due_date);
        case 'epic':
          return dirMul * compareValues(a.epic?.title, b.epic?.title);
        case 'team':
          return dirMul * compareValues(a.team?.name, b.team?.name);
        case 'sprint':
          return dirMul * compareValues(a.sprint?.name, b.sprint?.name);
        default:
          return 0;
      }
    });
    return list;
  }, [tasks, sort]);

  useEffect(() => {
    setPage(1);
  }, [tasks.length, sort.key, sort.dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pageIds = paged.map((t) => t.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const selectedTasks = useMemo(() => tasks.filter((t) => selected.has(t.id)), [tasks, selected]);

  const toggleSelectAllPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) pageIds.forEach((id) => next.add(id));
      else pageIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const SortButton = ({ sortKey, label }: { sortKey: SortKey; label: string }) => (
    <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1" onClick={() => toggleSort(sortKey)}>
      {label}
      {sort.key === sortKey ? (
        sort.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const columnCount = 7 + (isDesarrollo ? 3 : 0);

  return (
    <div className="space-y-3">
      <TaskBulkActionsBar
        projectId={projectId}
        selectedTasks={selectedTasks}
        isDesarrollo={isDesarrollo}
        isAdminOrLeader={!!isAdminOrLeader}
        onClearSelection={() => setSelected(new Set())}
      />

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => toggleSelectAllPage(!!checked)}
                  title={totalPages > 1 ? `Selecciona las ${pageIds.length} de esta página (hay ${totalPages} páginas en total)` : undefined}
                />
              </TableHead>
              <TableHead className="w-[100px]"><SortButton sortKey="task_number" label="Clave" /></TableHead>
              <TableHead><SortButton sortKey="title" label="Título" /></TableHead>
              <TableHead className="w-[130px]"><SortButton sortKey="status" label="Estado" /></TableHead>
              <TableHead className="w-[110px]"><SortButton sortKey="priority" label="Prioridad" /></TableHead>
              <TableHead className="w-[160px]"><SortButton sortKey="assignee" label="Responsable" /></TableHead>
              <TableHead className="w-[120px]"><SortButton sortKey="due_date" label="Fecha límite" /></TableHead>
              {isDesarrollo && <TableHead className="w-[130px]"><SortButton sortKey="epic" label="Épica" /></TableHead>}
              {isDesarrollo && <TableHead className="w-[130px]"><SortButton sortKey="team" label="Equipo" /></TableHead>}
              {isDesarrollo && <TableHead className="w-[130px]"><SortButton sortKey="sprint" label="Sprint" /></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? 'Ningún resultado con los filtros actuales' : 'No hay tareas en este proyecto'}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((task) => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick(task)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(task.id)}
                      onCheckedChange={(checked) => toggleSelectRow(task.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {projectKey}-{task.task_number}
                  </TableCell>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: `${task.status?.color}15`,
                        color: task.status?.color,
                        borderColor: task.status?.color,
                      }}
                    >
                      {task.status?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', priorityConfig[task.priority].className)}>
                      {priorityConfig[task.priority].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={task.assignee.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                            {getInitials(task.assignee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate max-w-[100px]">{task.assignee.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.due_date ? (() => {
                      const bucket = getDueBucket(task.due_date, !!task.status?.is_completed, todayStr);
                      const d = parseDateOnly(task.due_date);
                      return (
                        <span className={cn(
                          bucket === 'overdue' ? 'text-red-600 font-medium' : bucket === 'due_today' ? 'text-amber-700 font-medium' : 'text-muted-foreground',
                        )}>
                          {bucket === 'due_today' ? 'Vence hoy' : d ? format(d, 'd MMM yyyy', { locale: es }) : '-'}
                        </span>
                      );
                    })() : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  {isDesarrollo && (
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[130px]">
                      {task.epic?.title ?? '-'}
                    </TableCell>
                  )}
                  {isDesarrollo && (
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[130px]">
                      {task.team?.name ?? '-'}
                    </TableCell>
                  )}
                  {isDesarrollo && (
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[130px]">
                      {task.sprint?.name ?? '-'}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Mostrando {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sorted.length)} de {sorted.length} tareas</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span>{currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
