import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, FileText, Folder, BookOpen, Layout, Package } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Material {
  material_type_id: string;
  cantidad: number;
}

interface Tema {
  title: string;
  description: string;
  materiales: Material[];
}

interface Asignatura {
  name: string;
  code: string;
  description: string;
  semestre: number | null;
  temas: Tema[];
}

interface Programa {
  name: string;
  code: string;
  description: string;
  tipo_programa: string;
  asignaturas: Asignatura[];
}

interface CreateProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectWizard({ open, onOpenChange }: CreateProjectWizardProps) {
  const queryClient = useQueryClient();
  const { data: materialTypes = [] } = useMaterialTypes();
  const [isPending, setIsPending] = useState(false);

  // Tab 1: Información Básica
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState<string>('');

  // Tab 2: Programas
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [currentPrograma, setCurrentPrograma] = useState<Programa>({
    name: '',
    code: '',
    description: '',
    tipo_programa: '',
    asignaturas: [],
  });

  // Tab 3: Asignaturas (del programa seleccionado)
  const [selectedProgramaIndex, setSelectedProgramaIndex] = useState<number | null>(null);
  const [currentAsignatura, setCurrentAsignatura] = useState<Asignatura>({
    name: '',
    code: '',
    description: '',
    semestre: null,
    temas: [],
  });

  // Tab 4: Temas (de la asignatura seleccionada)
  const [selectedAsignaturaIndex, setSelectedAsignaturaIndex] = useState<number | null>(null);
  const [currentTema, setCurrentTema] = useState<Tema>({
    title: '',
    description: '',
    materiales: [],
  });

  const resetForm = () => {
    setName('');
    setKey('');
    setDescription('');
    setEndDate('');
    setProgramas([]);
    setCurrentPrograma({ name: '', code: '', description: '', tipo_programa: '', asignaturas: [] });
    setCurrentAsignatura({ name: '', code: '', description: '', semestre: null, temas: [] });
    setCurrentTema({ title: '', description: '', materiales: [] });
    setSelectedProgramaIndex(null);
    setSelectedAsignaturaIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !key.trim()) {
      toast.error('Nombre y clave son requeridos');
      return;
    }

    if (!endDate) {
      toast.error('La fecha de entrega/finalización del proyecto es requerida');
      return;
    }

    setIsPending(true);

    try {
      // Crear proyecto
      const projectResponse = await api.post('/api/projects', {
        name: name.trim(),
        key: key.trim(),
        description: description.trim() || null,
        end_date: endDate,
      });

      const projectId = projectResponse.id;

      // Crear programas y su contenido
      for (const programa of programas) {
        const programaResponse = await api.post(`/api/projects/${projectId}/programas`, {
          name: programa.name,
          code: programa.code || null,
          description: programa.description || null,
          tipo_programa: programa.tipo_programa || null,
        });

        const programaId = programaResponse.id;

        // Crear asignaturas del programa
        for (const asignatura of programa.asignaturas) {
          const asignaturaResponse = await api.post(`/api/programas/${programaId}/asignaturas`, {
            name: asignatura.name,
            code: asignatura.code || null,
            description: asignatura.description || null,
            semestre: asignatura.semestre || null,
          });

          const asignaturaId = asignaturaResponse.id;

          // Crear temas de la asignatura
          for (const tema of asignatura.temas) {
            const temaResponse = await api.post(`/api/asignaturas/${asignaturaId}/temas`, {
              title: tema.title,
              description: tema.description || null,
            });

            const temaId = temaResponse.id;

            // Crear materiales del tema
            for (const material of tema.materiales) {
              await api.post(`/api/temas/${temaId}/materiales`, {
                material_type_id: material.material_type_id,
                cantidad: material.cantidad,
              });
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyecto creado exitosamente');
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error al crear proyecto: ' + error.message);
    } finally {
      setIsPending(false);
    }
  };

  const addPrograma = () => {
    if (!currentPrograma.name.trim()) {
      toast.error('El nombre del programa es requerido');
      return;
    }

    setProgramas([...programas, currentPrograma]);
    setCurrentPrograma({ name: '', code: '', description: '', tipo_programa: '', asignaturas: [] });
    toast.success('Programa agregado');
  };

  const removePrograma = (index: number) => {
    setProgramas(programas.filter((_, i) => i !== index));
  };

  const addAsignatura = () => {
    if (selectedProgramaIndex === null) {
      toast.error('Selecciona un programa primero');
      return;
    }

    if (!currentAsignatura.name.trim()) {
      toast.error('El nombre de la asignatura es requerido');
      return;
    }

    const updatedProgramas = [...programas];
    updatedProgramas[selectedProgramaIndex].asignaturas.push(currentAsignatura);
    setProgramas(updatedProgramas);
    setCurrentAsignatura({ name: '', code: '', description: '', semestre: null, temas: [] });
    toast.success('Asignatura agregada');
  };

  const addTema = () => {
    if (selectedProgramaIndex === null || selectedAsignaturaIndex === null) {
      toast.error('Selecciona una asignatura primero');
      return;
    }

    if (!currentTema.title.trim()) {
      toast.error('El título del tema es requerido');
      return;
    }

    const updatedProgramas = [...programas];
    updatedProgramas[selectedProgramaIndex].asignaturas[selectedAsignaturaIndex].temas.push(
      currentTema
    );
    setProgramas(updatedProgramas);
    setCurrentTema({ title: '', description: '', materiales: [] });
    toast.success('Tema agregado');
  };

  const toggleMaterial = (materialTypeId: string) => {
    const exists = currentTema.materiales.find((m) => m.material_type_id === materialTypeId);
    if (exists) {
      setCurrentTema({
        ...currentTema,
        materiales: currentTema.materiales.map((m) =>
          m.material_type_id === materialTypeId ? { ...m, cantidad: m.cantidad + 1 } : m
        ),
      });
    } else {
      setCurrentTema({
        ...currentTema,
        materiales: [...currentTema.materiales, { material_type_id: materialTypeId, cantidad: 1 }],
      });
    }
  };

  const updateMaterialCantidad = (materialTypeId: string, cantidad: number) => {
    if (cantidad <= 0) {
      setCurrentTema({
        ...currentTema,
        materiales: currentTema.materiales.filter((m) => m.material_type_id !== materialTypeId),
      });
    } else {
      setCurrentTema({
        ...currentTema,
        materiales: currentTema.materiales.map((m) =>
          m.material_type_id === materialTypeId ? { ...m, cantidad } : m
        ),
      });
    }
  };

  const getMaterialName = (id: string) => materialTypes.find((mt) => mt.id === id)?.name || '';
  const getMaterialIcon = (id: string) => materialTypes.find((mt) => mt.id === id)?.icon || '📄';

  const totalAsignaturas = programas.reduce((sum, p) => sum + p.asignaturas.length, 0);
  const totalTemas = programas.reduce(
    (sum, p) => sum + p.asignaturas.reduce((s, a) => s + a.temas.length, 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Proyecto Educativo</DialogTitle>
            <DialogDescription>
              Configura toda la estructura del proyecto: programas, asignaturas, temas y materiales
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">
                <FileText className="h-4 w-4 mr-1" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="programs">
                <Folder className="h-4 w-4 mr-1" />
                Programas ({programas.length})
              </TabsTrigger>
              <TabsTrigger value="subjects">
                <BookOpen className="h-4 w-4 mr-1" />
                Asignaturas ({totalAsignaturas})
              </TabsTrigger>
              <TabsTrigger value="topics">
                <Layout className="h-4 w-4 mr-1" />
                Temas ({totalTemas})
              </TabsTrigger>
              <TabsTrigger value="review">
                <Package className="h-4 w-4 mr-1" />
                Revisar
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Información Básica */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Proyecto *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Contenidos 2025"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key">Clave (prefijo) *</Label>
                <Input
                  id="key"
                  placeholder="CONT-2025"
                  value={key}
                  onChange={(e) =>
                    setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10))
                  }
                  maxLength={10}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Se usará como prefijo para las tareas (ej: {key || 'CONT'}-1)
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
            </TabsContent>

            {/* Tab 2: Programas */}
            <TabsContent value="programs" className="space-y-4 mt-4">
              {programas.length > 0 && (
                <div className="space-y-2">
                  <Label>Programas Agregados</Label>
                  {programas.map((prog, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">{prog.name}</CardTitle>
                              {prog.tipo_programa && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {prog.tipo_programa}
                                </Badge>
                              )}
                            </div>
                            {prog.code && (
                              <CardDescription className="text-xs">{prog.code}</CardDescription>
                            )}
                            <Badge variant="secondary" className="mt-1">
                              {prog.asignaturas.length} asignaturas
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePrograma(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">Agregar Programa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre del Programa *</Label>
                      <Input
                        placeholder="Ej: Ingeniería de Sistemas"
                        value={currentPrograma.name}
                        onChange={(e) =>
                          setCurrentPrograma({ ...currentPrograma, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código</Label>
                      <Input
                        placeholder="Ej: ING-SIS"
                        value={currentPrograma.code}
                        onChange={(e) =>
                          setCurrentPrograma({ ...currentPrograma, code: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Programa *</Label>
                    <Select
                      value={currentPrograma.tipo_programa}
                      onValueChange={(value) =>
                        setCurrentPrograma({ ...currentPrograma, tipo_programa: value })
                      }
                    >
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
                    <Label>Descripción</Label>
                    <Textarea
                      placeholder="Descripción del programa..."
                      value={currentPrograma.description}
                      onChange={(e) =>
                        setCurrentPrograma({ ...currentPrograma, description: e.target.value })
                      }
                      rows={2}
                    />
                  </div>

                  <Button type="button" onClick={addPrograma} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Programa
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Asignaturas */}
            <TabsContent value="subjects" className="space-y-4 mt-4">
              {programas.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Primero debes agregar al menos un programa
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Selecciona el Programa</Label>
                    <Select
                      value={selectedProgramaIndex?.toString() || ''}
                      onValueChange={(value) => setSelectedProgramaIndex(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un programa" />
                      </SelectTrigger>
                      <SelectContent>
                        {programas.map((prog, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {prog.name} ({prog.asignaturas.length} asignaturas)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProgramaIndex !== null && (
                    <>
                      {programas[selectedProgramaIndex].asignaturas.length > 0 && (
                        <div className="space-y-2">
                          <Label>Asignaturas Agregadas</Label>
                          {programas[selectedProgramaIndex].asignaturas.map((asig, index) => (
                            <Card key={index}>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">{asig.name}</CardTitle>
                                <Badge variant="secondary">{asig.temas.length} temas</Badge>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      )}

                      <Card className="border-dashed">
                        <CardHeader>
                          <CardTitle className="text-sm">Agregar Asignatura</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Nombre *</Label>
                              <Input
                                placeholder="Ej: Matemáticas I"
                                value={currentAsignatura.name}
                                onChange={(e) =>
                                  setCurrentAsignatura({ ...currentAsignatura, name: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Código</Label>
                              <Input
                                placeholder="Ej: MAT101"
                                value={currentAsignatura.code}
                                onChange={(e) =>
                                  setCurrentAsignatura({ ...currentAsignatura, code: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Semestre</Label>
                            <Select
                              value={currentAsignatura.semestre?.toString() || ''}
                              onValueChange={(value) =>
                                setCurrentAsignatura({ ...currentAsignatura, semestre: parseInt(value) })
                              }
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

                          <Button type="button" onClick={addAsignatura} className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Asignatura
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab 4: Temas */}
            <TabsContent value="topics" className="space-y-4 mt-4">
              {totalAsignaturas === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Primero debes agregar asignaturas a tus programas
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Programa</Label>
                      <Select
                        value={selectedProgramaIndex?.toString() || ''}
                        onValueChange={(value) => {
                          setSelectedProgramaIndex(parseInt(value));
                          setSelectedAsignaturaIndex(null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un programa" />
                        </SelectTrigger>
                        <SelectContent>
                          {programas.map((prog, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {prog.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProgramaIndex !== null && (
                      <div className="space-y-2">
                        <Label>Asignatura</Label>
                        <Select
                          value={selectedAsignaturaIndex?.toString() || ''}
                          onValueChange={(value) => setSelectedAsignaturaIndex(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una asignatura" />
                          </SelectTrigger>
                          <SelectContent>
                            {programas[selectedProgramaIndex].asignaturas.map((asig, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {asig.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {selectedProgramaIndex !== null && selectedAsignaturaIndex !== null && (
                    <Card className="border-dashed">
                      <CardHeader>
                        <CardTitle className="text-sm">Agregar Tema</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Título del Tema *</Label>
                          <Input
                            placeholder="Ej: Ecuaciones Diferenciales"
                            value={currentTema.title}
                            onChange={(e) =>
                              setCurrentTema({ ...currentTema, title: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Materiales Requeridos</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {materialTypes.map((mt) => {
                              const material = currentTema.materiales.find(
                                (m) => m.material_type_id === mt.id
                              );
                              const cantidad = material?.cantidad || 0;

                              return (
                                <div
                                  key={mt.id}
                                  className="flex items-center justify-between p-2 border rounded-lg"
                                >
                                  <div className="flex items-center gap-1">
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
                                        onClick={() => toggleMaterial(mt.id)}
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

                        <Button type="button" onClick={addTema} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Tema
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab 5: Revisar */}
            <TabsContent value="review" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen del Proyecto</CardTitle>
                  <CardDescription>
                    Revisa toda la configuración antes de crear el proyecto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-semibold">{name || '(Sin nombre)'}</p>
                    <p className="text-sm text-muted-foreground">{key || '(Sin clave)'}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Estructura:</p>
                    <ul className="space-y-1 text-sm">
                      <li>📁 {programas.length} Programas</li>
                      <li>📚 {totalAsignaturas} Asignaturas</li>
                      <li>📖 {totalTemas} Temas</li>
                    </ul>
                  </div>

                  {programas.length === 0 && (
                    <p className="text-sm text-amber-600">
                      ⚠️ No has agregado ningún programa aún
                    </p>
                  )}
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
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || !key.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Proyecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
