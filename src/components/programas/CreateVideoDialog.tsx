import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAsignaturasByPrograma } from '@/hooks/useAsignaturas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateVideoDialogProps {
  programaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Un "video" es un tema (gránulo) dentro de una asignatura, que aquí funciona
// como el "curso" al que el video pertenece. Este formulario combina en un
// paso crear el curso (si es nuevo) y el video, en vez de tener que crear la
// asignatura y luego el tema por separado.
export function CreateVideoDialog({ programaId, open, onOpenChange }: CreateVideoDialogProps) {
  const { data: asignaturas = [] } = useAsignaturasByPrograma(programaId);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState('');
  const [newCursoName, setNewCursoName] = useState('');
  const [videoName, setVideoName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setMode(asignaturas.length > 0 ? 'existing' : 'new');
      setSelectedAsignaturaId('');
      setNewCursoName('');
      setVideoName('');
    }
  }, [open, asignaturas.length]);

  const canSubmit = videoName.trim() && (mode === 'existing' ? selectedAsignaturaId : newCursoName.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsPending(true);
    try {
      let asignaturaId = selectedAsignaturaId;

      if (mode === 'new') {
        const nuevaAsignatura = await api.post<{ id: string }>(`/api/programas/${programaId}/asignaturas`, {
          name: newCursoName.trim(),
          code: null,
          description: null,
          semestre: null,
        });
        asignaturaId = nuevaAsignatura.id;
      }

      await api.post(`/api/asignaturas/${asignaturaId}/temas`, {
        title: videoName.trim(),
        description: null,
      });

      toast.success('Video creado');
      queryClient.invalidateQueries({ queryKey: ['programa', programaId] });
      queryClient.invalidateQueries({ queryKey: ['programas'] });
      queryClient.invalidateQueries({ queryKey: ['asignaturas', 'programa', programaId] });
      queryClient.invalidateQueries({ queryKey: ['temas', asignaturaId] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Video</DialogTitle>
          <DialogDescription>Nombra el video y elige a qué curso pertenece.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-name">Nombre del video *</Label>
            <Input
              id="video-name"
              value={videoName}
              onChange={(e) => setVideoName(e.target.value)}
              placeholder="Ej: Introducción a la asignatura"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Curso asociado *</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('existing')}
                disabled={asignaturas.length === 0}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  mode === 'existing' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground'
                )}
              >
                Curso existente
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === 'new' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground'
                )}
              >
                Curso nuevo
              </button>
            </div>

            {mode === 'existing' ? (
              <Select value={selectedAsignaturaId} onValueChange={setSelectedAsignaturaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el curso" />
                </SelectTrigger>
                <SelectContent>
                  {asignaturas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={newCursoName}
                onChange={(e) => setNewCursoName(e.target.value)}
                placeholder="Ej: Fundamentos de Marketing"
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>Crear Video</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
