import { useState, useEffect } from 'react';
import { useUpdateAsignatura } from '@/hooks/useAsignaturas';
import {
  useMaterialesAsignatura,
  useMaterialTypes,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  MaterialRequerido,
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
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';

interface Asignatura {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  description: string | null;
}

interface EditAsignaturaDialogProps {
  asignatura: Asignatura | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAsignaturaDialog({
  asignatura,
  open,
  onOpenChange,
}: EditAsignaturaDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  // Material states
  const [selectedMaterialType, setSelectedMaterialType] = useState('');
  const [materialCantidad, setMaterialCantidad] = useState('1');
  const [editingMaterial, setEditingMaterial] = useState<MaterialRequerido | null>(null);
  const [editCantidad, setEditCantidad] = useState('1');

  const updateAsignatura = useUpdateAsignatura(asignatura?.project_id || '');
  const { data: materiales = [], isLoading: materialesLoading } = useMaterialesAsignatura(
    asignatura?.id
  );
  const { data: materialTypes = [] } = useMaterialTypes();
  const createMaterial = useCreateMaterial(asignatura?.id || '');
  const updateMaterial = useUpdateMaterial(asignatura?.id || '');
  const deleteMaterial = useDeleteMaterial(asignatura?.id || '');

  useEffect(() => {
    if (asignatura) {
      setName(asignatura.name);
      setCode(asignatura.code || '');
      setDescription(asignatura.description || '');
    }
  }, [asignatura]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!asignatura) return;

    updateAsignatura.mutate(
      {
        id: asignatura.id,
        data: {
          name,
          code: code || null,
          description: description || null,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleAddMaterial = () => {
    if (!selectedMaterialType) return;

    createMaterial.mutate(
      {
        material_type_id: selectedMaterialType,
        cantidad: parseInt(materialCantidad) || 1,
      },
      {
        onSuccess: () => {
          setSelectedMaterialType('');
          setMaterialCantidad('1');
        },
      }
    );
  };

  const handleUpdateMaterial = (material: MaterialRequerido) => {
    updateMaterial.mutate(
      {
        id: material.id,
        data: {
          cantidad: parseInt(editCantidad) || 1,
        },
      },
      {
        onSuccess: () => {
          setEditingMaterial(null);
        },
      }
    );
  };

  const handleDeleteMaterial = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este material?')) {
      deleteMaterial.mutate(id);
    }
  };

  const availableMaterialTypes = materialTypes.filter(
    (type) => !materiales.some((m) => m.material_type_id === type.id)
  );

  if (!asignatura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Asignatura</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la asignatura y gestiona sus materiales
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asignatura Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Matemáticas I"
                required
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
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción de la asignatura"
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Materials Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Materiales Requeridos</h3>

            {/* Add Material */}
            {availableMaterialTypes.length > 0 && (
              <div className="flex gap-2">
                <Select value={selectedMaterialType} onValueChange={setSelectedMaterialType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar tipo de material" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMaterialTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.icon} {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  min="1"
                  value={materialCantidad}
                  onChange={(e) => setMaterialCantidad(e.target.value)}
                  className="w-24"
                  placeholder="Cant."
                />

                <Button
                  type="button"
                  onClick={handleAddMaterial}
                  disabled={!selectedMaterialType || createMaterial.isPending}
                  size="icon"
                >
                  {createMaterial.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Materials List */}
            {materialesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : materiales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay materiales agregados
              </p>
            ) : (
              <div className="space-y-2">
                {materiales.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center gap-2 p-3 rounded-md border bg-muted/30"
                  >
                    <span className="text-xl">{material.material_type?.icon || '📄'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{material.material_type?.name}</p>
                    </div>

                    {editingMaterial?.id === material.id ? (
                      <>
                        <Input
                          type="number"
                          min="1"
                          value={editCantidad}
                          onChange={(e) => setEditCantidad(e.target.value)}
                          className="w-20"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUpdateMaterial(material)}
                          disabled={updateMaterial.isPending}
                        >
                          {updateMaterial.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Guardar'
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMaterial(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-muted-foreground">
                          Cantidad: {material.cantidad}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingMaterial(material);
                            setEditCantidad(material.cantidad.toString());
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteMaterial(material.id)}
                          disabled={deleteMaterial.isPending}
                        >
                          {deleteMaterial.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateAsignatura.isPending || !name.trim()}>
              {updateAsignatura.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
