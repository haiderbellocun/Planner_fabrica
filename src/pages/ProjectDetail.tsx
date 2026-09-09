import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProject, useCompleteProject, useDeleteProject, useUpdateProject, usePinProject, useUnpinProject } from '@/hooks/useProjects';
import { useTasks, useTask, TaskWithDetails } from '@/hooks/useTasks';
import { useProgramas, useDeletePrograma, Programa } from '@/hooks/useProgramas';
import { useEpics } from '@/hooks/useEpics';
import { PROJECT_STATUS_BADGES } from '@/lib/projectStatus';
import { Epic } from '@/hooks/useEpics';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { ProgramaCardComplete } from '@/components/programas/ProgramaCardComplete';
import { CreateEditProgramaDialog } from '@/components/programas/CreateEditProgramaDialog';
import { EpicsPanel } from '@/components/epics/EpicsPanel';
import { CreateEpicDialog } from '@/components/epics/CreateEpicDialog';
import { TeamsPanel } from '@/components/teams/TeamsPanel';
import { BacklogPanel } from '@/components/sprints/BacklogPanel';
import { useSprints } from '@/hooks/useSprints';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { getBusinessTodayStr, getDueBucket } from '@/lib/dueDate';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskFilters, EMPTY_TASK_FILTERS, hasActiveFilters, taskFiltersToQuery } from '@/lib/taskFilters';
import { ChecklistTab } from '@/components/checklist/ChecklistTab';
import { ProjectActivityFeed } from '@/components/projects/ProjectActivityFeed';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatTile } from '@/components/shared/StoryUI';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { Plus, LayoutGrid, List, Loader2, Users, Settings, Trash2, Link2, Pencil, Check, X, CalendarCheck2, Pin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(projectId, taskFilters);
  const { data: programas = [], isLoading: programasLoading } = useProgramas(projectId);
  const { data: epics = [] } = useEpics(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Tarea abierta vía enlace directo `?task=<id>` — misma param en toda la app (búsqueda,
  // notificaciones, o navegación interna) para que abrir/cerrar el detalle sea compartible,
  // sobreviva a un F5, y responda a Atrás/Adelante del navegador.
  const taskParam = searchParams.get('task');
  const { data: deepLinkTask, isError: deepLinkTaskError } = useTask(taskParam ?? undefined);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [activeTab, setActiveTab] = useState<'tasks' | 'programas' | 'epics' | 'teams' | 'backlog' | 'checklist' | 'activity'>('tasks');
  const [programaDialogOpen, setProgramaDialogOpen] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<Programa | null>(null);
  const [epicDialogOpen, setEpicDialogOpen] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);

  const deletePrograma = useDeletePrograma(projectId || '');
  const completeProject = useCompleteProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const pinProject = usePinProject();
  const unpinProject = useUnpinProject();

  const [editingLink, setEditingLink] = useState(false);
  const [editLinks, setEditLinks] = useState<{ label: string; url: string }[]>([{ label: '', url: '' }]);

  const isLeader =
    user?.role === 'admin' ||
    user?.role === 'project_leader' ||
    project?.members?.some(
      (member) => member.user_id === user?.profileId && member.role === 'leader'
    );

  const canManageAsignaturas = isLeader;
  const canCompleteProject = isLeader;
  const isDesarrolloProject = project?.tipo_programa === 'desarrollo';
  const canManageEpics = isLeader;
  const canManageTeams = isLeader;

  // Abrir una tarea siempre pasa por la URL (`?task=<id>`) — el efecto de más abajo hace el
  // resto (buscarla en la lista ya cargada o dejar un placeholder mientras se resuelve por id).
  // Empuja una entrada de historial para que Atrás/Adelante abran/cierren el detalle.
  const openTask = (taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('task', taskId);
    setSearchParams(next);
  };

  const closeTaskDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next);
  };

  const handleTaskClick = (task: TaskWithDetails) => openTask(task.id);

  // Navigating from a subtask row (or its parent breadcrumb) inside the sheet only gives us an id.
  const handleNavigateToTask = (taskId: string) => openTask(taskId);

  const buildPlaceholderTask = (taskId: string): TaskWithDetails => ({
    id: taskId,
    project_id: projectId || '',
    epic_id: null,
    team_id: null,
    sprint_id: null,
    title: '',
    description: null,
    priority: 'medium',
    status_id: '',
    assignee_id: null,
    reporter_id: null,
    start_date: null,
    due_date: null,
    tags: [],
    task_number: null,
    material_requerido_id: null,
    asignatura_id: null,
    parent_task_id: null,
    subtask_of_id: null,
    horas_estimadas: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: { id: '', name: '', description: null, color: '#94a3b8', display_order: 0, is_default: false, is_completed: false, created_at: '' },
    assignee: null,
    reporter: null,
  });

  // Fuente de verdad: el parámetro `?task=` de la URL. Cubre apertura por clic, enlace directo
  // (búsqueda/notificaciones) al cargar la página, y Atrás/Adelante del navegador.
  useEffect(() => {
    if (!taskParam) {
      setDetailOpen(false);
      return;
    }

    if (deepLinkTaskError) {
      toast.error('Esta tarea no existe o no tienes acceso a ella.');
      closeTaskDetail();
      return;
    }

    const found = tasks.find((t) => t.id === taskParam);
    setSelectedTask(deepLinkTask ?? found ?? buildPlaceholderTask(taskParam));
    setDetailOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, deepLinkTask, deepLinkTaskError]);

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
            {PROJECT_STATUS_BADGES[project.status as keyof typeof PROJECT_STATUS_BADGES] && (() => {
              const { label, className } = PROJECT_STATUS_BADGES[project.status as keyof typeof PROJECT_STATUS_BADGES];
              return <Badge className={className}>{label}</Badge>;
            })()}
          </div>
          <p className="page-description">{project.description || 'Sin descripción'}</p>

          {/* Links del proyecto */}
          {(() => {
            const parsedLinks: { label: string; url: string }[] = (() => {
              if (!project.link) return [];
              if (project.link.startsWith('[')) {
                try { return JSON.parse(project.link); } catch { /* fall through */ }
              }
              return [{ label: project.link_label || '', url: project.link }];
            })();

            return (
              <div className="mt-1">
                {editingLink ? (
                  <div className="space-y-1.5">
                    {editLinks.map((lnk, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <Input
                          className="h-7 text-sm w-32"
                          placeholder="Nombre"
                          value={lnk.label}
                          onChange={(e) => setEditLinks(prev => prev.map((l, i) => i === idx ? { ...l, label: e.target.value } : l))}
                        />
                        <Input
                          className="h-7 text-sm w-56"
                          placeholder="https://..."
                          value={lnk.url}
                          onChange={(e) => setEditLinks(prev => prev.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                        />
                        {editLinks.length > 1 && (
                          <button type="button" onClick={() => setEditLinks(prev => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button type="button"
                        onClick={() => setEditLinks(prev => [...prev, { label: '', url: '' }])}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                        <Plus className="h-3 w-3" /> Agregar enlace
                      </button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600"
                        onClick={() => {
                          const valid = editLinks.filter(l => l.url.trim());
                          const serialized = valid.length === 0 ? null : JSON.stringify(valid);
                          updateProject.mutate({ id: projectId!, link: serialized, link_label: null } as any);
                          setEditingLink(false);
                        }}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setEditingLink(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : parsedLinks.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {parsedLinks.map((lnk, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground font-medium">{lnk.label || 'Enlace'}:</span>
                        <a href={lnk.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate max-w-[220px]">
                          {lnk.url}
                        </a>
                      </div>
                    ))}
                    {canManageAsignaturas && (
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => { setEditLinks(parsedLinks.length > 0 ? parsedLinks : [{ label: '', url: '' }]); setEditingLink(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : canManageAsignaturas ? (
                  <Button variant="ghost" size="sm" className="h-7 text-muted-foreground text-xs px-2"
                    onClick={() => { setEditLinks([{ label: '', url: '' }]); setEditingLink(true); }}>
                    <Link2 className="h-3 w-3 mr-1" />
                    Agregar enlace
                  </Button>
                ) : null}
              </div>
            );
          })()}

          {/* Fecha de entrega */}
          {project.end_date && (
            <div className="flex items-center gap-1.5 mt-1">
              <CalendarCheck2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Fecha de entrega:</span>
              <span className="text-xs font-medium text-foreground">
                {format(new Date(project.end_date.slice(0, 10) + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {projectId && (
            <Button
              variant="outline"
              size="icon"
              className={project.is_pinned ? 'text-amber-500 border-amber-200' : undefined}
              title={project.is_pinned ? 'Desfijar proyecto' : 'Fijar proyecto'}
              onClick={() => (project.is_pinned ? unpinProject : pinProject).mutate(projectId)}
            >
              <Pin className={cn('h-4 w-4', project.is_pinned && 'fill-current')} />
            </Button>
          )}
          <Button variant="outline" size="icon">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          {user?.role === 'admin' && projectId && (
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={deleteProject.isPending}
              onClick={() => {
                if (!confirm(`¿Eliminar el proyecto "${project.name}"? Se eliminarán todas sus tareas, épicas y programas. Esta acción no se puede deshacer.`)) return;
                deleteProject.mutate(projectId, {
                  onSuccess: () => navigate('/projects'),
                });
              }}
              title="Eliminar proyecto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {project.status !== 'completed' && project.status !== 'paused' && (
            <Button onClick={() => setCreateTaskOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Tarea
            </Button>
          )}
          {canCompleteProject && project.status !== 'completed' && projectId && (
            <Button
              variant="outline"
              onClick={() => {
                const pausing = project.status !== 'paused';
                if (
                  !confirm(
                    pausing
                      ? '¿Pausar este proyecto? No se podrán crear tareas nuevas hasta reanudarlo.'
                      : '¿Reanudar este proyecto?'
                  )
                ) {
                  return;
                }
                updateProject.mutate({ id: projectId, status: pausing ? 'paused' : 'active' });
              }}
              disabled={updateProject.isPending}
            >
              {project.status === 'paused' ? 'Reanudar proyecto' : 'Pausar proyecto'}
            </Button>
          )}
          {canCompleteProject && project.status !== 'completed' && projectId && (
            <Button
              variant="outline"
              onClick={() => {
                if (
                  !confirm(
                    '¿Estás seguro de finalizar este proyecto? Todas las tareas deben estar completadas.'
                  )
                ) {
                  return;
                }
                completeProject.mutate(projectId);
              }}
              disabled={completeProject.isPending}
            >
              {completeProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Finalizar proyecto'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tasks' | 'programas' | 'epics' | 'teams' | 'backlog' | 'checklist' | 'activity')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          {canManageAsignaturas && (
            <TabsTrigger value="programas">Programas ({programas.length})</TabsTrigger>
          )}
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          {isDesarrolloProject && (
            <TabsTrigger value="epics">Épicas ({epics.length})</TabsTrigger>
          )}
          {isDesarrolloProject && (
            <TabsTrigger value="teams">Equipos</TabsTrigger>
          )}
          {isDesarrolloProject && (
            <TabsTrigger value="backlog">Backlog ({sprints.length})</TabsTrigger>
          )}
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {/* Snapshot: task-status narrative strip */}
          {tasks.length > 0 && (() => {
            const completed = tasks.filter(t => t.status?.is_completed).length;
            const todayStr = getBusinessTodayStr();
            const overdue = tasks.filter(t => getDueBucket(t.due_date, !!t.status?.is_completed, todayStr) === 'overdue').length;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Tareas totales" value={tasks.length} />
                <StatTile label="Completadas" value={completed} sub={`${Math.round((completed / tasks.length) * 100)}% del total`} />
                <StatTile label="En curso" value={tasks.length - completed - overdue} />
                <StatTile
                  label="Vencidas"
                  value={overdue}
                  pill={overdue > 0 ? { tone: 'critical', label: 'Atención' } : { tone: 'good', label: 'Al día' }}
                />
              </div>
            );
          })()}

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

          <TaskFilterBar
            projectId={projectId!}
            filters={taskFilters}
            onChange={setTaskFilters}
            isDesarrollo={isDesarrolloProject}
          />

          {/* Content */}
          {view === 'board' ? (
            <KanbanBoard
              tasks={tasks}
              projectKey={project.key}
              projectId={projectId!}
              onTaskClick={handleTaskClick}
              isLoading={tasksLoading}
            />
          ) : (
            <TaskListView
              tasks={tasks}
              projectKey={project.key}
              projectId={projectId!}
              onTaskClick={handleTaskClick}
              isDesarrollo={isDesarrolloProject}
              isAdminOrLeader={!!isLeader}
              isLoading={tasksLoading}
              hasActiveFilters={hasActiveFilters(taskFilters)}
              filtersKey={taskFiltersToQuery(taskFilters)}
            />
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
                {canManageAsignaturas && (
                  <Button className="mt-4" onClick={handleCreatePrograma}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Programa
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {canManageAsignaturas && (
                <div className="flex justify-end">
                  <Button onClick={handleCreatePrograma}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Programa
                  </Button>
                </div>
              )}
              <div className="grid gap-4">
                {programas.map((programa: any) => (
                  <ProgramaCardComplete
                    key={programa.id}
                    programa={programa}
                    onEdit={() => handleEditPrograma(programa)}
                    onDelete={() => handleDeletePrograma(programa)}
                    canManage={canManageAsignaturas}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistTab projectId={projectId!} />
        </TabsContent>

        <TabsContent value="activity">
          <ProjectActivityFeed
            projectId={projectId!}
            projectKey={project.key}
            onTaskClick={(taskId) => {
              handleNavigateToTask(taskId);
              setDetailOpen(true);
            }}
          />
        </TabsContent>

        {isDesarrolloProject && (
          <TabsContent value="epics" className="space-y-4">
            <EpicsPanel
              projectId={projectId!}
              canManage={canManageEpics ?? false}
              tasks={tasks}
              onTaskClick={handleTaskClick}
            />
          </TabsContent>
        )}

        {isDesarrolloProject && (
          <TabsContent value="teams" className="space-y-4">
            <TeamsPanel
              projectId={projectId!}
              canManage={canManageTeams ?? false}
              members={project.members}
              tasks={tasks}
              onTaskClick={handleTaskClick}
            />
          </TabsContent>
        )}

        {isDesarrolloProject && (
          <TabsContent value="backlog" className="space-y-4">
            <BacklogPanel
              projectId={projectId!}
              projectKey={project.key}
              canManage={canManageEpics ?? false}
              tasks={tasks}
              onTaskClick={handleTaskClick}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        projectId={projectId!}
        tipoPrograma={project.tipo_programa}
      />

      <TaskDetailSheet
        task={selectedTask}
        projectKey={project.key}
        open={detailOpen}
        onOpenChange={(open) => { if (!open) closeTaskDetail(); }}
        onNavigateToTask={handleNavigateToTask}
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

      <CreateEpicDialog
        projectId={projectId!}
        epic={selectedEpic}
        open={epicDialogOpen}
        onOpenChange={(open) => {
          setEpicDialogOpen(open);
          if (!open) setSelectedEpic(null);
        }}
      />
    </div>
  );
}
