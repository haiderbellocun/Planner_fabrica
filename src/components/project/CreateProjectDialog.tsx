import { useState } from 'react';
import { useCreateProject } from '@/hooks/useProjects';
import { useMaterialTypes } from '@/hooks/useMateriales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, GraduationCap, BookOpen, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Asignatura {
  name: string;
  code: string;
  description: string;
  materiales: Array<{
    material_type_id: string;
    cantidad: number;
  }>;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProjectCategory = 'academico' | 'marketing' | 'otros';

const TIPO_PROGRAMA_OPTIONS = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'diplomado', label: 'Diplomado' },
  { value: 'maestria', label: 'Maestría' },
  { value: 'doctorado', label: 'Doctorado' },
];

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const createProject = useCreateProject();
  const { data: materialTypes = [] } = useMaterialTypes();

  // Basic info
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [tipoPrograma, setTipoPrograma] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [category, setCategory] = useState<ProjectCategory | null>(null);

  // Marketing-only info
  const [marketingPiecesType, setMarketingPiecesType] = useState<'imagen' | 'video' | 'ambos' | ''>('');
  const [marketingFormat, setMarketingFormat] = useState<string>(''); // reels, historias, etc (texto libre por ahora)
  const [marketingVideoKind, setMarketingVideoKind] = useState<'promocional' | 'institucional' | ''>('');

  // Asignaturas
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [currentAsignatura, setCurrentAsignatura] = useState<Asignatura>({
    name: '',
    code: '',
    description: '',
    materiales: [],
  });

  const resetForm = () => {
    setName('');
    setKey('');
    setDescription('');
    setTipoPrograma('');
    setEndDate('');
    setCategory(null);
    setMarketingPiecesType('');
    setMarketingFormat('');
    setMarketingVideoKind('');
    setAsignaturas([]);
    setCurrentAsignatura({ name: '', code: '', description: '', materiales: [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error('Selecciona primero el tipo de proyecto (Académico, Marketing u Otros).');
      return;
    }

    if (!endDate) {
      // La API también lo valida, pero lo exigimos en el cliente para mejor UX
      return;
    }

    // Construimos una descripción enriquecida según el tipo de proyecto
    let finalDescription = description || '';

    if (category === 'marketing') {
      const marketingSummaryLines = [
        '',
        '[Proyecto de Marketing]',
        `Piezas: ${marketingPiecesType || 'no especificado'}`,
        `Formato(s): ${marketingFormat || 'no especificado'}`,
        `Tipo de video: ${marketingVideoKind || 'no aplica'}`,
      ];
      finalDescription = `${finalDescription}${marketingSummaryLines.join('\n')}`.trim();
    } else if (category === 'otros') {
      const extra = '\n[Proyecto de tipo: Otros]';
      finalDescription = `${finalDescription}${extra}`;
    } else if (category === 'academico') {
      const extra = '\n[Proyecto Académico]';
      finalDescription = `${finalDescription}${extra}`;
    }

    await createProject.mutateAsync({
      name,
      key,
      description: finalDescription || undefined,
      end_date: endDate,
      tipo_programa: tipoPrograma as any || undefined,
      asignaturas: asignaturas.length > 0 ? asignaturas : undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const addAsignatura = () => {
    if (!currentAsignatura.name.trim()) return;

    setAsignaturas([...asignaturas, currentAsignatura]);
    setCurrentAsignatura({ name: '', code: '', description: '', materiales: [] });
  };

  const removeAsignatura = (index: number) => {
    setAsignaturas(asignaturas.filter((_, i) => i !== index));
  };

  const addMaterial = (materialTypeId: string) => {
    const exists = currentAsignatura.materiales.find((m) => m.material_type_id === materialTypeId);
    if (exists) {
      // Increment quantity
      setCurrentAsignatura({
        ...currentAsignatura,
        materiales: currentAsignatura.materiales.map((m) =>
          m.material_type_id === materialTypeId ? { ...m, cantidad: m.cantidad + 1 } : m
        ),
      });
    } else {
      // Add new material
      setCurrentAsignatura({
        ...currentAsignatura,
        materiales: [...currentAsignatura.materiales, { material_type_id: materialTypeId, cantidad: 1 }],
      });
    }
  };

  const updateMaterialCantidad = (materialTypeId: string, cantidad: number) => {
    if (cantidad <= 0) {
      // Remove material
      setCurrentAsignatura({
        ...currentAsignatura,
        materiales: currentAsignatura.materiales.filter((m) => m.material_type_id !== materialTypeId),
      });
    } else {
      setCurrentAsignatura({
        ...currentAsignatura,
        materiales: currentAsignatura.materiales.map((m) =>
          m.material_type_id === materialTypeId ? { ...m, cantidad } : m
        ),
      });
    }
  };

  const getMaterialName = (materialTypeId: string) => {
    return materialTypes.find((mt) => mt.id === materialTypeId)?.name || '';
  };

  const getMaterialIcon = (materialTypeId: string) => {
    return materialTypes.find((mt) => mt.id === materialTypeId)?.icon || '📄';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Proyecto</DialogTitle>
            <DialogDescription>
              Crea un nuevo proyecto educativo con sus asignaturas y materiales
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">
                <FileText className="h-4 w-4 mr-2" />
                Información Básica
              </TabsTrigger>
              <TabsTrigger value="program">
                <GraduationCap className="h-4 w-4 mr-2" />
                Tipo de Programa
              </TabsTrigger>
              <TabsTrigger value="subjects">
                <BookOpen className="h-4 w-4 mr-2" />
                Asignaturas ({asignaturas.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Proyecto *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Contenidos 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key">Clave (prefijo) *</Label>
                <Input
                  id="key"
                  placeholder="CONT-2024"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Se usará como prefijo para las tareas (ej: {key || 'CONT-2024'}-1)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Fecha de entrega / finalización *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describe el proyecto..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Selección de tipo de proyecto */}
              <div className="space-y-3 pt-2">
                <Label>Tipo de proyecto *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={category === 'academico' ? 'default' : 'outline'}
                    className="justify-center"
                    onClick={() => setCategory('academico')}
                  >
                    Académico
                  </Button>
                  <Button
                    type="button"
                    variant={category === 'marketing' ? 'default' : 'outline'}
                    className="justify-center"
                    onClick={() => setCategory('marketing')}
                  >
                    Marketing
                  </Button>
                  <Button
                    type="button"
                    variant={category === 'otros' ? 'default' : 'outline'}
                    className="justify-center"
                    onClick={() => setCategory('otros')}
                  >
                    Otros
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Según el tipo, se mostrarán campos adicionales relevantes.
                </p>
              </div>

              {/* Campos específicos para proyectos de Marketing */}
              {category === 'marketing' && (
                <div className="mt-4 space-y-4 rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Configuración de proyecto de Marketing</p>

                  <div className="space-y-2">
                    <Label>Tipo de piezas</Label>
                    <Select
                      value={marketingPiecesType}
                      onValueChange={(value: 'imagen' | 'video' | 'ambos') =>
                        setMarketingPiecesType(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de piezas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imagen">Solo imágenes</SelectItem>
                        <SelectItem value="video">Solo videos</SelectItem>
                        <SelectItem value="ambos">Imágenes y videos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Formatos de las piezas</Label>
                    <Input
                      placeholder="Ej: Reels, historias, posts, banners..."
                      value={marketingFormat}
                      onChange={(e) => setMarketingFormat(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Puedes escribir una lista separada por comas.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de video</Label>
                    <Select
                      value={marketingVideoKind}
                      onValueChange={(value: 'promocional' | 'institucional') =>
                        setMarketingVideoKind(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de video (si aplica)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="promocional">Promocional</SelectItem>
                        <SelectItem value="institucional">Institucional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="program" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_programa">Tipo de Programa</Label>
                <Select value={tipoPrograma} onValueChange={setTipoPrograma} disabled={category !== 'academico'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_PROGRAMA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo se usa para proyectos académicos.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="subjects" className="space-y-4">
              {/* Lista de asignaturas agregadas */}
              {asignaturas.length > 0 && (
                <div className="space-y-2">
                  <Label>Asignaturas Agregadas</Label>
                  <div className="space-y-2">
                    {asignaturas.map((asig, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{asig.name}</CardTitle>
                              {asig.code && (
                                <CardDescription className="text-xs">{asig.code}</CardDescription>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAsignatura(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <div className="flex flex-wrap gap-1">
                            {asig.materiales.map((mat) => (
                              <Badge key={mat.material_type_id} variant="secondary" className="text-xs">
                                {getMaterialIcon(mat.material_type_id)} {getMaterialName(mat.material_type_id)}: {mat.cantidad}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulario para nueva asignatura */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">Agregar Asignatura</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="asig_name">Nombre de la Asignatura</Label>
                      <Input
                        id="asig_name"
                        placeholder="Ej: Matemáticas"
                        value={currentAsignatura.name}
                        onChange={(e) =>
                          setCurrentAsignatura({ ...currentAsignatura, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="asig_code">Código (opcional)</Label>
                      <Input
                        id="asig_code"
                        placeholder="Ej: MAT-101"
                        value={currentAsignatura.code}
                        onChange={(e) =>
                          setCurrentAsignatura({ ...currentAsignatura, code: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Materiales Requeridos</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {materialTypes.map((mt) => {
                        const material = currentAsignatura.materiales.find(
                          (m) => m.material_type_id === mt.id
                        );
                        const cantidad = material?.cantidad || 0;

                        return (
                          <div
                            key={mt.id}
                            className="flex items-center justify-between p-2 border rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{mt.icon}</span>
                              <span className="text-xs">{mt.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {cantidad > 0 ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => updateMaterialCantidad(mt.id, cantidad - 1)}
                                  >
                                    -
                                  </Button>
                                  <span className="text-sm w-6 text-center">{cantidad}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => updateMaterialCantidad(mt.id, cantidad + 1)}
                                  >
                                    +
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => addMaterial(mt.id)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={addAsignatura}
                    disabled={!currentAsignatura.name.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Asignatura
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || !name.trim() || !key.trim() || !endDate}
            >
              {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Proyecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
