import { useState, useMemo } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderKanban, Users, ListTodo, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreateProjectWizard } from '@/components/project/CreateProjectWizard';
import { cn } from '@/lib/utils';

const TIPO_LABELS: Record<string, string> = {
  profesional:  'Profesional',
  diplomado:    'Diplomado',
  maestria:     'Maestría',
  doctorado:    'Doctorado',
};

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipo, setFilterTipo]     = useState<string>('all');
  const [filterMonth, setFilterMonth]   = useState<number>(-1); // -1 = todos

  const canCreateProject = user?.role === 'admin' || user?.role === 'project_leader';

  // Base list según rol
  const baseProjects = useMemo(() =>
    user?.role === 'admin'
      ? [...projects].sort((a, b) => {
          const aC = a.status === 'completed', bC = b.status === 'completed';
          return aC === bC ? 0 : aC ? 1 : -1;
        })
      : projects.filter((p) => p.status !== 'completed'),
  [projects, user?.role]);

  // Tipos y meses disponibles
  const availableTipos = useMemo(() =>
    [...new Set(baseProjects.map((p) => p.tipo_programa).filter(Boolean))] as string[],
  [baseProjects]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    baseProjects.forEach((p) => {
      if (p.end_date) months.add(new Date(p.end_date).getMonth());
    });
    return [...months].sort((a, b) => a - b);
  }, [baseProjects]);

  // Aplicar filtros
  const visibleProjects = useMemo(() =>
    baseProjects.filter((p) => {
      if (filterStatus !== 'all') {
        if (filterStatus === 'active'    && p.status === 'completed') return false;
        if (filterStatus === 'completed' && p.status !== 'completed') return false;
      }
      if (filterTipo !== 'all' && p.tipo_programa !== filterTipo) return false;
      if (filterMonth !== -1 && p.end_date && new Date(p.end_date).getMonth() !== filterMonth) return false;
      return true;
    }),
  [baseProjects, filterStatus, filterTipo, filterMonth]);

  const hasFilters = filterStatus !== 'all' || filterTipo !== 'all' || filterMonth !== -1;

  const clearFilters = () => { setFilterStatus('all'); setFilterTipo('all'); setFilterMonth(-1); };

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="page-description">Gestiona todos tus proyectos</p>
        </div>
        {canCreateProject && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {canCreateProject && (
        <CreateProjectWizard open={dialogOpen} onOpenChange={setDialogOpen} />
      )}

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Estado */}
        {['all','active','completed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filterStatus === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Finalizados'}
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Tipo */}
        {availableTipos.map((t) => (
          <button
            key={t}
            onClick={() => setFilterTipo(filterTipo === t ? 'all' : t)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filterTipo === t
                ? 'bg-teal-500 text-white border-teal-500'
                : 'bg-white text-muted-foreground border-border hover:border-teal-400'
            )}
          >
            {TIPO_LABELS[t] ?? t}
          </button>
        ))}

        {availableMonths.length > 0 && <div className="h-4 w-px bg-border mx-1" />}

        {/* Mes de entrega */}
        {availableMonths.map((m) => (
          <button
            key={m}
            onClick={() => setFilterMonth(filterMonth === m ? -1 : m)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filterMonth === m
                ? 'bg-amber-400 text-white border-amber-400'
                : 'bg-white text-muted-foreground border-border hover:border-amber-300'
            )}
          >
            {MONTH_NAMES[m]}
          </button>
        ))}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="ml-1 flex items-center gap-1 px-2 py-1.5 rounded-full text-xs text-muted-foreground hover:text-destructive border border-border hover:border-destructive/40 transition-colors"
          >
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
      </div>

      {visibleProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay proyectos</h3>
            <p className="text-muted-foreground text-center mb-4">
              {canCreateProject
                ? 'Crea tu primer proyecto para empezar a gestionar tareas'
                : 'No tienes proyectos asignados aún'}
            </p>
            {canCreateProject && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Proyecto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="relative h-full hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden">
                <img src="./Logo_coordinador_de_fabrica.png" alt="" className="absolute bottom-0 right-0 h-32 w-32 object-contain opacity-40 pointer-events-none z-0" />
                <CardHeader className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary">{project.key}</Badge>
                      {project.status === 'completed' && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-2 py-0">
                          Finalizado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="mt-3">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || 'Sin descripción'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ListTodo className="h-4 w-4" />
                        <span>{project.tasks_count} tareas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{project.members.length}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
