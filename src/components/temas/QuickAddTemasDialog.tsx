import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface QuickAddTemasDialogProps {
  asignaturaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddTemasDialog({ asignaturaId, open, onOpenChange }: QuickAddTemasDialogProps) {
  const [raw, setRaw] = useState('');
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const titles = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (titles.length === 0) return;

    setIsPending(true);
    let created = 0;
    try {
      for (const title of titles) {
        await api.post(`/api/asignaturas/${asignaturaId}/temas`, { title, description: null });
        created++;
      }
      toast.success(`${created} gránulo${created === 1 ? '' : 's'} creado${created === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ['temas', asignaturaId] });
      setRaw('');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Se crearon ${created} de ${titles.length} — error: ${error.message}`);
      queryClient.invalidateQueries({ queryKey: ['temas', asignaturaId] });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar varios gránulos</DialogTitle>
          <DialogDescription>Un título por línea, se crean todos como temas de esta asignatura.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="raw">Gránulos *</Label>
            <Textarea
              id="raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'Introducción al curso\nUnidad 1: Conceptos básicos\nUnidad 2: Aplicaciones'}
              rows={8}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {titles.length} gránulo{titles.length === 1 ? '' : 's'} a crear
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || titles.length === 0}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>Crear {titles.length || ''} gránulo{titles.length === 1 ? '' : 's'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
