import { useState, useEffect } from 'react';
import { useCreateTema, useUpdateTema, Tema } from '@/hooks/useTemas';
import {
  useMaterialTypes,
  useMaterialesTema,
  useCreateMaterialTema,
  useDeleteMaterialTema,
} from '@/hooks/useMateriales';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface CreateEditTemaDialogProps {
  asignaturaId: string;
  tema: Tema | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEditTemaDialog({
  asignaturaId,
  tema,
  open,
  onOpenChange,
}: CreateEditTemaDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  // Material selection state
  const [selectedMaterialType, setSelectedMaterialType] = useState('');
  const [materialCantidad, setMaterialCantidad] = useState(1);
  const [materialDescripcion, setMaterialDescripcion] = useState('');

  const createTema = useCreateTema(asignaturaId);
  const updateTema = useUpdateTema(asignaturaId);
  const { data: materialTypes = [] } = useMaterialTypes();
  const { data: materiales = [] } = useMaterialesTema(tema?.id);
  const createMaterial = useCreateMaterialTema(tema?.id || '');
  const deleteMaterial = useDeleteMaterialTema(tema?.id || '');

  const isEditing = !!tema;

  useEffect(() => {
    if (tema) {
      setTitle(tema.title);
      setDescription(tema.description || '');
      setActiveTab('info');
    } else {
      setTitle('');
      setDescription('');
      setActiveTab('info');
    }
  }, [tema, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    if (isEditing) {
      updateTema.mutate(
        {
          id: tema.id,
          data: {
            title: title.trim(),
            description: description.trim() || null,
          },
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createTema.mutate(
        {
          title: title.trim(),
          description: description.trim() || null,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    }
  };

  const handleAddMaterial = () => {
    if (!selectedMaterialType || !tema) return;

    createMaterial.mutate(
      {
        material_type_id: selectedMaterialType,
        cantidad: materialCantidad,
        descripcion: materialDescripcion || null,
      },
      {
        onSuccess: () => {
          setSelectedMaterialType('');
          setMaterialCantidad(1);
          setMaterialDescripcion('');
        },
      }
    );
  };

  const handleDeleteMaterial = (materialId: string) => {
    if (confirm('¿Eliminar este material?')) {
      deleteMaterial.mutate(materialId);
    }
  };

  const isPending = createTema.isPending || updateTema.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tema' : 'Crear Tema'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los detalles del tema y sus materiales'
              : 'Crea un nuevo tema para esta asignatura'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="materiales" disabled={!isEditing}>
              Materiales {isEditing && materiales.length > 0 && `(${materiales.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título del Tema *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Ecuaciones Diferenciales"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción del tema"
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
                <Button type="submit" disabled={isPending || !title.trim()}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? 'Actualizando...' : 'Creando...'}
                    </>
                  ) : (
                    <>{isEditing ? 'Actualizar' : 'Crear Tema'}</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="materiales" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Agregar Material</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedMaterialType}
                    onValueChange={setSelectedMaterialType}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar tipo de material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.icon} {type.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min="1"
                    value={materialCantidad}
                    onChange={(e) => setMaterialCantidad(parseInt(e.target.value) || 1)}
                    placeholder="Cant."
                    className="w-20"
                  />

                  <Button
                    type="button"
                    size="icon"
                    onClick={handleAddMaterial}
                    disabled={!selectedMaterialType || createMaterial.isPending}
                  >
                    {createMaterial.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <Input
                  value={materialDescripcion}
                  onChange={(e) => setMaterialDescripcion(e.target.value)}
                  placeholder="Descripción opcional"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Materiales Requeridos</Label>
                {materiales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                    No hay materiales agregados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {materiales.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between p-2 border rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{material.material_type.icon}</span>
                          <div>
                            <div className="text-sm font-medium">
                              {material.material_type.description}
                            </div>
                            {material.descripcion && (
                              <div className="text-xs text-muted-foreground">
                                {material.descripcion}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">x{material.cantidad}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteMaterial(material.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
