import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { MyFocusToday } from '@/components/dashboard/MyFocusToday';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HeroBanner, StatTile } from '@/components/shared/StoryUI';
import {
  FolderKanban,
  Bell,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: notifications = [] } = useNotifications();

  // Calculate stats
  const totalProjects = projects.length;
  const totalTasks = projects.reduce((acc, p) => acc + Number(p.tasks_count ?? 0), 0);
  // "En curso" = total - completadas, not the same figure as "Tareas totales" below.
  const pendingTasksCount = projects.reduce(
    (acc, p) => acc + Math.max(Number(p.tasks_count ?? 0) - Number(p.completed_tasks ?? 0), 0),
    0
  );

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
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

  const unreadNotifications = notifications.filter((n) => !n.read);

  if (projectsLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Usuario';
  const activeProjectsCount = projects.filter((p) => p.status !== 'completed').length;

  return (
    <div className="page-container relative">
      {/* Ocean decorations */}
      <img src="./deco_medusa.png" alt="" className="absolute top-4 right-8 h-28 w-auto object-contain opacity-20 pointer-events-none select-none hidden lg:block" style={{ transform: 'rotate(10deg)' }} />
      <img src="./deco_manta.png" alt="" className="absolute top-32 right-4 h-20 w-auto object-contain opacity-15 pointer-events-none select-none hidden lg:block" style={{ transform: 'rotate(-5deg)' }} />
      <img src="./deco_cangrejo.png" alt="" className="absolute bottom-24 left-6 h-16 w-auto object-contain opacity-20 pointer-events-none select-none hidden xl:block" />
      <img src="./deco_estrella.png" alt="" className="absolute bottom-8 right-12 h-14 w-auto object-contain opacity-20 pointer-events-none select-none hidden xl:block" />

      <HeroBanner
        eyebrow={greeting()}
        story={
          <>
            Hola <b className="text-white">{firstName}</b> — tienes{' '}
            <b className="text-white">{activeProjectsCount} proyectos activos</b>.
            {unreadNotifications.length > 0 && (
              <> Tienes <b className="text-white">{unreadNotifications.length} notificaciones</b> sin leer.</>
            )}
            {' '}Tu detalle de tareas está justo debajo, en "Tu foco hoy".
          </>
        }
        stats={[
          { value: totalProjects, label: 'Proyectos totales' },
          { value: unreadNotifications.length, label: 'Notificaciones nuevas' },
        ]}
      />

      <div className="space-y-8 mt-8">
      <MyFocusToday />
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatTile
          label="Proyectos"
          value={totalProjects}
          sub={`${activeProjectsCount} activos`}
          decorationImage="./deco_foca.png"
          accentImage="./deco_alga2.png"
        />
        <StatTile
          label="Tareas totales"
          value={totalTasks}
          sub={`${pendingTasksCount} activas`}
          decorationImage="./deco_cangrejo.png"
        />
        <StatTile
          label="Notificaciones"
          value={unreadNotifications.length}
          sub="Sin leer"
          pill={unreadNotifications.length > 0 ? { tone: 'info', label: 'Nuevo' } : undefined}
          decorationImage="./deco_medusa.png"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 md:gap-8">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">Proyectos Recientes</CardTitle>
                <CardDescription className="text-sm mt-0.5">Tus proyectos activos</CardDescription>
              </div>
              <Link to="/projects" className="text-primary-deep hover:text-primary no-underline hover:underline">
                <Button variant="ghost" size="sm" className="text-primary-deep hover:text-primary font-medium p-0 h-auto">
                  Ver todos
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-10">
                  <div className="stat-icon-circle h-14 w-14 mx-auto mb-4">
                    <FolderKanban className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground mb-4">No tienes proyectos aún</p>
                  <Link to="/projects">
                    <Button className="rounded-lg">Crear Proyecto</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 5).map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                    >
                      <div className="stat-icon-circle">
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate text-foreground">{project.name}</p>
                          <Badge variant="secondary" className="text-[10px] font-medium rounded-md">
                            {project.key}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {project.tasks_count} tareas · {project.members.length} miembros
                        </p>
                      </div>
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 3).map((member) => (
                          <Avatar key={member.id} className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(member.profile?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notifications - Snapshot style */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">Notificaciones</CardTitle>
                <CardDescription className="text-sm mt-0.5">Actividad reciente</CardDescription>
              </div>
              <Link to="/notifications" className="text-primary-deep hover:text-primary no-underline hover:underline">
                <Button variant="ghost" size="sm" className="text-primary-deep hover:text-primary font-medium p-0 h-auto">
                  Ver todas
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-10">
                  <div className="stat-icon-circle h-14 w-14 mx-auto mb-4">
                    <Bell className="h-7 w-7" />
                  </div>
                  <p className="text-muted-foreground">Sin notificaciones</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-3 rounded-xl border text-sm',
                        !notification.read ? 'bg-primary/5 border-primary/20' : 'border-border'
                      )}
                    >
                      <p className="font-medium text-foreground mb-0.5">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

</div>
    </div>
  );
}
