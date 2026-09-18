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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface QuickAddAsignaturasDialogProps {
  programaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Una asignatura por línea. Prefijo "N:" para fijar el semestre de esa línea
// puntual (ej: "3: Cálculo II"); si no lo trae, usa el semestre por defecto.
function parseLine(line: string, defaultSemestre: number | null): { name: string; semestre: number | null } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})\s*[:\-]\s*(.+)$/);
  if (match) {
    return { name: match[2].trim(), semestre: parseInt(match[1], 10) };
  }
  return { name: trimmed, semestre: defaultSemestre };
}

export function QuickAddAsignaturasDialog({ programaId, open, onOpenChange }: QuickAddAsignaturasDialogProps) {
  const [defaultSemestre, setDefaultSemestre] = useState<number | null>(null);
  const [raw, setRaw] = useState('');
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const lines = raw.split('\n').map((l) => parseLine(l, defaultSemestre)).filter(Boolean) as { name: string; semestre: number | null }[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return;

    setIsPending(true);
    let created = 0;
    try {
      for (const line of lines) {
        await api.post(`/api/programas/${programaId}/asignaturas`, {
          name: line.name,
          code: null,
          description: null,
          semestre: line.semestre,
        });
        created++;
      }
      toast.success(`${created} asignatura${created === 1 ? '' : 's'} creada${created === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ['programa', programaId] });
      queryClient.invalidateQueries({ queryKey: ['programas'] });
      setRaw('');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Se crearon ${created} de ${lines.length} — error: ${error.message}`);
      queryClient.invalidateQueries({ queryKey: ['programa', programaId] });
      queryClient.invalidateQueries({ queryKey: ['programas'] });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar varias asignaturas</DialogTitle>
          <DialogDescription>
            Una por línea. Para fijar el semestre de una línea en particular, escribe "3: Nombre" al inicio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-semestre">Semestre por defecto</Label>
            <Select
              value={defaultSemestre?.toString() || ''}
              onValueChange={(value) => setDefaultSemestre(parseInt(value))}
            >
              <SelectTrigger id="default-semestre">
                <SelectValue placeholder="Sin semestre / se define por línea" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}º Semestre</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="raw">Asignaturas *</Label>
            <Textarea
              id="raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'Cálculo I\n3: Cálculo II\nÁlgebra Lineal'}
              rows={8}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {lines.length} asignatura{lines.length === 1 ? '' : 's'} a crear
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || lines.length === 0}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>Crear {lines.length || ''} asignatura{lines.length === 1 ? '' : 's'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
