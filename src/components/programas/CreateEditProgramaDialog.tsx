import { useState, useEffect } from 'react';
import { useCreatePrograma, useUpdatePrograma, Programa } from '@/hooks/useProgramas';
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

interface CreateEditProgramaDialogProps {
  projectId: string;
  programa: Programa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEditProgramaDialog({
  projectId,
  programa,
  open,
  onOpenChange,
}: CreateEditProgramaDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [tipoPrograma, setTipoPrograma] = useState('');

  const createPrograma = useCreatePrograma(projectId);
  const updatePrograma = useUpdatePrograma(projectId);

  const isEditing = !!programa;

  useEffect(() => {
    if (programa) {
      setName(programa.name);
      setCode(programa.code || '');
      setDescription(programa.description || '');
      setTipoPrograma(programa.tipo_programa || '');
    } else {
      setName('');
      setCode('');
      setDescription('');
      setTipoPrograma('');
    }
  }, [programa, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    if (isEditing) {
      updatePrograma.mutate(
        {
          id: programa.id,
          data: {
            name: name.trim(),
            code: code.trim() || null,
            description: description.trim() || null,
            tipo_programa: tipoPrograma || null,
          },
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createPrograma.mutate(
        {
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          tipo_programa: tipoPrograma || null,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    }
  };

  const isPending = createPrograma.isPending || updatePrograma.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Programa' : 'Crear Programa'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los detalles del programa'
              : 'Crea un nuevo programa para organizar asignaturas'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Programa *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Ingeniería de Sistemas"
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
              placeholder="Ej: ING-SIS"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_programa">Tipo de Programa</Label>
            <Select value={tipoPrograma} onValueChange={setTipoPrograma}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de programa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tecnico">Técnico</SelectItem>
                <SelectItem value="tecnologo">Tecnólogo</SelectItem>
                <SelectItem value="diplomado">Diplomado</SelectItem>
                <SelectItem value="profesional">Profesional</SelectItem>
                <SelectItem value="maestria">Maestría</SelectItem>
                <SelectItem value="doctorado">Doctorado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del programa"
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
                <>{isEditing ? 'Actualizar' : 'Crear Programa'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
