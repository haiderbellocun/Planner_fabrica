import { useState, useMemo } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderKanban, Loader2, X, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreateProjectWizard } from '@/components/project/CreateProjectWizard';
import { cn } from '@/lib/utils';

const TIPO_LABELS: Record<string, string> = {
  profesional:  'Profesional',
  diplomado:    'Diplomado',
  maestria:     'Maestría',
  doctorado:    'Doctorado',
};

const TIPO_COLORS: Record<string, string> = {
  profesional: 'bg-blue-100 text-blue-700 border-blue-200',
  diplomado:   'bg-amber-100 text-amber-700 border-amber-200',
  maestria:    'bg-purple-100 text-purple-700 border-purple-200',
  doctorado:   'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatEndDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

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
          {visibleProjects.map((project) => {
            const total = Number(project.tasks_count) || 0;
            const done  = Number(project.completed_tasks) || 0;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
            const endDate = formatEndDate(project.end_date);
            const isCompleted = project.status === 'completed';

            return (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="h-full hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden">
                  <CardContent className="p-5 flex flex-col gap-3 h-full">

                    {/* Row 1: badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-xs">{project.key}</Badge>
                      {project.tipo_programa && (
                        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border', TIPO_COLORS[project.tipo_programa] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                          {TIPO_LABELS[project.tipo_programa] ?? project.tipo_programa}
                        </span>
                      )}
                      {isCompleted && (
                        <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Finalizado
                        </span>
                      )}
                    </div>

                    {/* Row 2: name + icon */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderKanban className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug line-clamp-1">{project.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {project.description || 'Sin descripción'}
                        </p>
                      </div>
                    </div>

                    {/* Row 3: progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {done} / {total} tareas completadas
                        </span>
                        <span className="font-medium text-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-emerald-500' : 'bg-primary')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Row 4: end date */}
                    {endDate && (
                      <div className="flex items-center mt-auto pt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Entrega {endDate}
                        </span>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
