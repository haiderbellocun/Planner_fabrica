import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Sprint, useCreateSprint, useUpdateSprint } from '@/hooks/useSprints';
import { DIALOG_SIZES } from '@/lib/dialogSizes';

interface CreateSprintDialogProps {
  projectId: string;
  sprint?: Sprint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSprintDialog({ projectId, sprint, open, onOpenChange }: CreateSprintDialogProps) {
  const createSprint = useCreateSprint(projectId);
  const updateSprint = useUpdateSprint(projectId);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toDateInput = (val: string | null | undefined) => (val ? val.slice(0, 10) : '');

  useEffect(() => {
    if (!open) return;
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? '');
      setStartDate(toDateInput(sprint.start_date));
      setEndDate(toDateInput(sprint.end_date));
      return;
    }
    setName('');
    setGoal('');
    setStartDate('');
    setEndDate('');
  }, [open, sprint]);

  const isPending = createSprint.isPending || updateSprint.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      goal: goal.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    };

    if (sprint) {
      updateSprint.mutate({ sprintId: sprint.id, data: payload }, { onSuccess: () => onOpenChange(false) });
      return;
    }
    createSprint.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_SIZES.sm}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{sprint ? 'Editar sprint' : 'Nuevo sprint'}</DialogTitle>
            <DialogDescription>
              {sprint ? 'Actualiza los datos del sprint.' : 'Crea un sprint para planificar un ciclo de trabajo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sprint-name">Nombre *</Label>
              <Input
                id="sprint-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Sprint 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-goal">Objetivo</Label>
              <Textarea
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="¿Qué se busca lograr en este sprint?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sprint-start-date">Fecha inicio</Label>
                <Input
                  id="sprint-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprint-end-date">Fecha fin</Label>
                <Input
                  id="sprint-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sprint ? 'Guardar cambios' : 'Crear sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
