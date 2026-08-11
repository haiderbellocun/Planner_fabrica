import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusPill } from '@/components/shared/StoryUI';
import { useTaskSearch } from '@/hooks/useEquipoPlan';
import { parseDateOnly } from '@/lib/dates';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssigneeId?: string;
  onSelectTask: (taskId: string) => void;
}

export function TaskPickerDialog({ open, onOpenChange, defaultAssigneeId, onSelectTask }: TaskPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [onlyAssignee, setOnlyAssignee] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setOnlyAssignee(true);
    }
  }, [open]);

  const effectiveAssigneeId = onlyAssignee ? defaultAssigneeId : undefined;
  const hasSearch = debouncedQuery.trim().length >= 2 || !!effectiveAssigneeId;
  const { data: results = [], isFetching } = useTaskSearch(debouncedQuery, effectiveAssigneeId);

  const handleSelect = (taskId: string) => {
    onSelectTask(taskId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar tarea al plan</DialogTitle>
          <DialogDescription>Busca una tarea de cualquier proyecto para agregarla a esta semana.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Buscar por título..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {defaultAssigneeId && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={onlyAssignee}
                onCheckedChange={(checked) => setOnlyAssignee(checked === true)}
              />
              Solo tareas asignadas a esta persona
            </label>
          )}

          <div className="max-h-80 overflow-y-auto space-y-1">
            {isFetching && (
              <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>
            )}
            {!isFetching && !hasSearch && (
              <p className="text-sm text-muted-foreground text-center py-4">Escribe al menos 2 letras para buscar</p>
            )}
            {!isFetching && hasSearch && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
            )}
            {!isFetching && results.map((task) => {
              const dueDate = parseDateOnly(task.due_date);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleSelect(task.id)}
                  className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{task.title}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{task.project.key}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <StatusPill tone={task.status.is_completed ? 'good' : 'info'}>{task.status.name}</StatusPill>
                      {dueDate && <span>{format(dueDate, 'd MMM', { locale: es })}</span>}
                      {task.assignee && <span className="truncate">· {task.assignee.full_name}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
