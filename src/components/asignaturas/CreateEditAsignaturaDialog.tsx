import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface Asignatura {
  id: string;
  programa_id: string;
  name: string;
  code: string | null;
  description: string | null;
  semestre: number | null;
}

interface CreateEditAsignaturaDialogProps {
  programaId: string;
  asignatura: Asignatura | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEditAsignaturaDialog({
  programaId,
  asignatura,
  open,
  onOpenChange,
}: CreateEditAsignaturaDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [semestre, setSemestre] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);

  const queryClient = useQueryClient();
  const isEditing = !!asignatura;

  useEffect(() => {
    if (asignatura) {
      setName(asignatura.name);
      setCode(asignatura.code || '');
      setDescription(asignatura.description || '');
      setSemestre(asignatura.semestre || null);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setSemestre(null);
    }
  }, [asignatura, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsPending(true);

    try {
      if (isEditing) {
        await api.patch(`/api/asignaturas/${asignatura.id}`, {
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          semestre: semestre || null,
        });
        toast.success('Asignatura actualizada');
      } else {
        await api.post(`/api/programas/${programaId}/asignaturas`, {
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          semestre: semestre || null,
        });
        toast.success('Asignatura creada');
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['programa', programaId] });
      queryClient.invalidateQueries({ queryKey: ['programas'] });

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
          <DialogTitle>
            {isEditing ? 'Editar Asignatura' : 'Crear Asignatura'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los detalles de la asignatura'
              : 'Crea una nueva asignatura para este programa'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Asignatura *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Matemáticas I"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: MAT101"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="semestre">Semestre</Label>
            <Select
              value={semestre?.toString() || ''}
              onValueChange={(value) => setSemestre(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el semestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1er Semestre</SelectItem>
                <SelectItem value="2">2do Semestre</SelectItem>
                <SelectItem value="3">3er Semestre</SelectItem>
                <SelectItem value="4">4to Semestre</SelectItem>
                <SelectItem value="5">5to Semestre</SelectItem>
                <SelectItem value="6">6to Semestre</SelectItem>
                <SelectItem value="7">7mo Semestre</SelectItem>
                <SelectItem value="8">8vo Semestre</SelectItem>
                <SelectItem value="9">9no Semestre</SelectItem>
                <SelectItem value="10">10mo Semestre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la asignatura"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                <>{isEditing ? 'Actualizar' : 'Crear Asignatura'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
