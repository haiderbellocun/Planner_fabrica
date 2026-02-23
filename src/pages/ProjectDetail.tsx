import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/hooks/useProjects';
import { useTasks, TaskWithDetails } from '@/hooks/useTasks';
import { useProgramas, useDeletePrograma, Programa } from '@/hooks/useProgramas';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { ProgramaCardComplete } from '@/components/programas/ProgramaCardComplete';
import { CreateEditProgramaDialog } from '@/components/programas/CreateEditProgramaDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, LayoutGrid, List, Loader2, Users, Settings, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(projectId);
  const { data: programas = [], isLoading: programasLoading } = useProgramas(projectId);

  console.log('📊 ProjectDetail render:', {
    projectId,
    tasksCount: tasks.length,
    tasksLoading,
    userEmail: user?.email,
    tasks: tasks.map(t => ({ title: t.title, status: t.status.name }))
  });

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [activeTab, setActiveTab] = useState<'tasks' | 'programas'>('tasks');
  const [programaDialogOpen, setProgramaDialogOpen] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<Programa | null>(null);

  const deletePrograma = useDeletePrograma(projectId || '');

  // Check if user can manage asignaturas (admin or project leader)
  const canManageAsignaturas =
    user?.role === 'admin' ||
    project?.members?.some(
      (member) => member.user_id === user?.profileId && member.role === 'leader'
    );

  const handleTaskClick = (task: TaskWithDetails) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleEditPrograma = (programa: Programa) => {
    setSelectedPrograma(programa);
    setProgramaDialogOpen(true);
  };

  const handleDeletePrograma = (programa: Programa) => {
    if (
      confirm(
        `¿Estás seguro de eliminar el programa "${programa.name}"? Esto también eliminará todas sus asignaturas, temas y materiales.`
      )
    ) {
      deletePrograma.mutate(programa.id);
    }
  };

  const handleCreatePrograma = () => {
    setSelectedPrograma(null);
    setProgramaDialogOpen(true);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (projectLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-container">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-2">Proyecto no encontrado</h2>
          <p className="text-muted-foreground mb-4">
            El proyecto que buscas no existe o no tienes acceso
          </p>
          <Link to="/projects">
            <Button>Volver a Proyectos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects">Proyectos</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="page-title">{project.name}</h1>
            <Badge variant="secondary">{project.key}</Badge>
          </div>
          <p className="page-description">{project.description || 'Sin descripción'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-2">
            {project.members.slice(0, 4).map((member) => (
              <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                <AvatarImage src={member.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(member.profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Button variant="outline" size="icon">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateTaskOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tasks' | 'programas')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          {canManageAsignaturas && (
            <TabsTrigger value="programas">Programas ({programas.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('board')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Tablero
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="mr-2 h-4 w-4" />
              Lista
            </Button>
          </div>

          {/* Content */}
          {view === 'board' ? (
            <KanbanBoard
              tasks={tasks}
              projectKey={project.key}
              onTaskClick={handleTaskClick}
              isLoading={tasksLoading}
            />
          ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Clave</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead className="w-[100px]">Prioridad</TableHead>
                <TableHead className="w-[150px]">Responsable</TableHead>
                <TableHead className="w-[120px]">Fecha límite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay tareas en este proyecto
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTaskClick(task)}
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {project.key}-{task.task_number}
                    </TableCell>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${task.status?.color}15`,
                          color: task.status?.color,
                          borderColor: task.status?.color,
                        }}
                      >
                        {task.status?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', priorityConfig[task.priority].className)}>
                        {priorityConfig[task.priority].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignee.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                              {getInitials(task.assignee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate max-w-[100px]">
                            {task.assignee.full_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.due_date
                        ? format(new Date(task.due_date), 'd MMM yyyy', { locale: es })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
        </TabsContent>

        <TabsContent value="programas" className="space-y-4">
          {programasLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : programas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  Este proyecto no tiene programas configurados aún
                </p>
                <Button className="mt-4" onClick={handleCreatePrograma}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Programa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={handleCreatePrograma}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Programa
                </Button>
              </div>
              <div className="grid gap-4">
                {programas.map((programa: any) => (
                  <ProgramaCardComplete
                    key={programa.id}
                    programa={programa}
                    onEdit={() => handleEditPrograma(programa)}
                    onDelete={() => handleDeletePrograma(programa)}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        projectId={projectId!}
      />

      <TaskDetailSheet
        task={selectedTask}
        projectKey={project.key}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <CreateEditProgramaDialog
        projectId={projectId!}
        programa={selectedPrograma}
        open={programaDialogOpen}
        onOpenChange={(open) => {
          setProgramaDialogOpen(open);
          if (!open) setSelectedPrograma(null);
        }}
      />
    </div>
  );
}
