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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Epic, useCreateEpic, useUpdateEpic } from '@/hooks/useEpics';
import { useEquipos } from '@/hooks/useEquipos';

interface CreateEpicDialogProps {
  projectId: string;
  epic?: Epic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6'];

const STATUS_OPTIONS: Array<{ value: Epic['status']; label: string }> = [
  { value: 'open', label: 'Abierta' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

const NO_EQUIPO = 'none';

export function CreateEpicDialog({ projectId, epic, open, onOpenChange }: CreateEpicDialogProps) {
  const createEpic = useCreateEpic(projectId);
  const updateEpic = useUpdateEpic(projectId);
  const { data: equipos = [] } = useEquipos();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [status, setStatus] = useState<Epic['status']>('open');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [equipoId, setEquipoId] = useState<string>(NO_EQUIPO);

  const toDateInput = (val: string | null | undefined) => {
    if (!val) return '';
    return val.slice(0, 10);
  };

  useEffect(() => {
    if (!open) return;
    if (epic) {
      setTitle(epic.title);
      setDescription(epic.description ?? '');
      setColor(epic.color || PRESET_COLORS[0]);
      setStatus(epic.status);
      setStartDate(toDateInput(epic.start_date));
      setEndDate(toDateInput(epic.end_date));
      setEquipoId(epic.equipo_id ?? NO_EQUIPO);
      return;
    }

    setTitle('');
    setDescription('');
    setColor(PRESET_COLORS[0]);
    setStatus('open');
    setStartDate('');
    setEndDate('');
    setEquipoId(NO_EQUIPO);
  }, [open, epic]);

  const isPending = createEpic.isPending || updateEpic.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      color,
      status,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      equipo_id: equipoId === NO_EQUIPO ? null : equipoId,
    };

    if (epic) {
      updateEpic.mutate(
        { epicId: epic.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
      return;
    }

    createEpic.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{epic ? 'Editar épica' : 'Nueva épica'}</DialogTitle>
            <DialogDescription>
              {epic ? 'Actualiza los datos de la épica.' : 'Crea una épica para organizar tareas del proyecto.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="epic-title">Título *</Label>
              <Input
                id="epic-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Implementación módulo de reportes"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="epic-description">Descripción</Label>
              <Textarea
                id="epic-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe objetivo y alcance de la épica..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: preset,
                      borderColor: color === preset ? '#111827' : 'transparent',
                    }}
                    aria-label={`Seleccionar color ${preset}`}
                    title={preset}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-8 p-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as Epic['status'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="epic-start-date">Fecha inicio</Label>
                <Input
                  id="epic-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="epic-end-date">Fecha fin</Label>
                <Input
                  id="epic-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Equipo</Label>
                <Select value={equipoId} onValueChange={setEquipoId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_EQUIPO}>Sin equipo</SelectItem>
                    {equipos.map((equipo) => (
                      <SelectItem key={equipo.id} value={equipo.id}>
                        {equipo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {epic ? 'Guardar cambios' : 'Crear épica'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
