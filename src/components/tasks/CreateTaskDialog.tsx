import { useState } from 'react';
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
import { useProfiles } from '@/hooks/useProfiles';
import { useCreateTask, useTaskStatuses } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useAsignaturasByPrograma } from '@/hooks/useAsignaturas';
import { useProgramas } from '@/hooks/useProgramas';
import { useTemasWithMateriales } from '@/hooks/useTemas';
import { Loader2 } from 'lucide-react';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function CreateTaskDialog({ open, onOpenChange, projectId }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [programaId, setProgramaId] = useState<string>('');
  const [asignaturaId, setAsignaturaId] = useState<string>('');

  const { user } = useAuth();
  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useProfiles();
  const { data: programas = [], isLoading: programasLoading } = useProgramas(projectId);
  const { data: asignaturas = [], isLoading: asignaturasLoading } = useAsignaturasByPrograma(programaId || undefined);
  const { data: temasWithMateriales = [], isLoading: temasLoading } = useTemasWithMateriales(asignaturaId || undefined);
  const createTask = useCreateTask();

  // Only admin and project_leader can assign tasks
  const canAssignTasks = user?.role === 'admin' || user?.role === 'project_leader';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createTask.mutateAsync({
      project_id: projectId,
      title,
      description: description || undefined,
      priority,
      assignee_id: canAssignTasks && assigneeId ? assigneeId : undefined,
      due_date: dueDate || undefined,
      asignatura_id: asignaturaId || undefined,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssigneeId('');
    setDueDate('');
    setProgramaId('');
    setAsignaturaId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Tarea</DialogTitle>
            <DialogDescription>
              Crea una nueva tarea para este proyecto
            </DialogDescription>
          </DialogHeader>

          {profilesError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              Error al cargar usuarios: {(profilesError as Error).message}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Título de la tarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe la tarea..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {canAssignTasks && (
                <div className="space-y-2">
                  <Label htmlFor="assignee">Responsable</Label>
                  <Select value={assigneeId || "unassigned"} onValueChange={(v) => setAssigneeId(v === "unassigned" ? "" : v)} disabled={profilesLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={profilesLoading ? "Cargando..." : "Seleccionar responsable"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name || profile.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="programa">Programa (opcional)</Label>
                <Select
                  value={programaId || "none"}
                  onValueChange={(v) => {
                    setProgramaId(v === "none" ? "" : v);
                    setAsignaturaId(""); // Reset asignatura when programa changes
                  }}
                  disabled={programasLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={programasLoading ? "Cargando..." : "Seleccionar programa"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin programa</SelectItem>
                    {programas.map((programa) => (
                      <SelectItem key={programa.id} value={programa.id}>
                        {programa.name} {programa.code ? `(${programa.code})` : ''}
                        {programa.tipo_programa && ` - ${programa.tipo_programa}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {programaId && (
                <div className="space-y-2">
                  <Label htmlFor="asignatura">Asignatura (opcional)</Label>
                  <Select
                    value={asignaturaId || "none"}
                    onValueChange={(v) => setAsignaturaId(v === "none" ? "" : v)}
                    disabled={asignaturasLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={asignaturasLoading ? "Cargando..." : "Seleccionar asignatura"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignatura</SelectItem>
                      {asignaturas.map((asignatura) => (
                        <SelectItem key={asignatura.id} value={asignatura.id}>
                          {asignatura.name} {asignatura.code ? `(${asignatura.code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {asignaturaId && (
                <div className="space-y-3">
                  <Label>Temas y Materiales</Label>
                  {temasLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">Cargando temas...</span>
                    </div>
                  ) : temasWithMateriales.length > 0 ? (
                    <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto space-y-3 bg-muted/30">
                      {temasWithMateriales.map((tema) => (
                        <div key={tema.id} className="space-y-2">
                          <div className="font-semibold text-sm text-primary flex items-center">
                            <span className="mr-2">📚</span>
                            {tema.title}
                          </div>
                          {tema.materiales && tema.materiales.length > 0 ? (
                            <div className="ml-6 space-y-1">
                              {tema.materiales.map((material: any) => (
                                <div key={material.id} className="text-sm text-foreground/80 flex items-start">
                                  <span className="mr-2">{material.icon}</span>
                                  <span>
                                    {material.name}
                                    {material.descripcion && (
                                      <span className="text-muted-foreground"> - {material.descripcion}</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="ml-6 text-sm text-muted-foreground italic">
                              Sin materiales en este tema
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center bg-muted/30">
                      No hay temas con materiales en esta asignatura
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha límite</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTask.isPending || !title.trim()}>
              {createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Tarea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
