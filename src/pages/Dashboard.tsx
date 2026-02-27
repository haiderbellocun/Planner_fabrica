import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useTasks, useTaskStatuses } from '@/hooks/useTasks';
import { MyFocusToday } from '@/components/dashboard/MyFocusToday';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  FolderKanban,
  ListTodo,
  TrendingUp,
  Bell,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import projectsImg from '@/assets/dashboard/projects.png';
import tasksImg from '@/assets/dashboard/tasks.png';
import notificationsImg from '@/assets/dashboard/notifications.png.png';
import productivityImg from '@/assets/dashboard/productivity.png';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: notifications = [] } = useNotifications();
  const { data: statuses = [] } = useTaskStatuses();

  // Calculate stats
  const totalProjects = projects.length;
  const totalTasks = projects.reduce((acc, p) => acc + Number(p.tasks_count ?? 0), 0);
  const completedStatus = statuses.find((s) => s.is_completed);

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

  return (
    <div className="page-container">
      {/* Welcome - Snapshot style */}
      <div className="page-header">
        <h1 className="page-title">
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'Usuario'}
        </h1>
        <p className="page-description">
          Bienvenido al centro de control. Aquí tienes un resumen de tu actividad.
        </p>
      </div>

      <div className="space-y-8">
      <MyFocusToday />
      {/* Stats Cards — KPI recipe: rounded-2xl, shadow, icon badge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 md:gap-8">
        <Card className="relative rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <img src={projectsImg} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-80 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium">
              Proyectos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-3xl font-semibold text-[#0F172A]">{totalProjects}</div>
            <p className="text-xs text-[#64748B] mt-0.5">Proyectos activos</p>
          </CardContent>
        </Card>

        <Card className="relative rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <img src={tasksImg} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-80 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium">
              Tareas Totales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-3xl font-semibold text-[#0F172A]">{totalTasks}</div>
            <p className="text-xs text-[#64748B] mt-0.5">En todos los proyectos</p>
          </CardContent>
        </Card>

        <Card className="relative rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <img src={notificationsImg} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-80 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium">
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-3xl font-semibold text-[#0F172A]">{unreadNotifications.length}</div>
            <p className="text-xs text-[#64748B] mt-0.5">Sin leer</p>
          </CardContent>
        </Card>

        <Card className="relative rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <img src={productivityImg} alt="" className="absolute right-4 top-4 h-20 w-20 object-contain opacity-80 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-[11px] uppercase tracking-wide text-[#64748B] font-medium">
              Productividad
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-3xl font-semibold text-[#0F172A]">—</div>
            <p className="text-xs text-[#64748B] mt-0.5">Próximamente</p>
          </CardContent>
        </Card>
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
              <Link to="/projects" className="text-[#0DD9D0] hover:text-[#0BBFB7] no-underline hover:underline">
                <Button variant="ghost" size="sm" className="text-[#0DD9D0] hover:text-[#0BBFB7] font-medium p-0 h-auto">
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
              <Link to="/notifications" className="text-[#0DD9D0] hover:text-[#0BBFB7] no-underline hover:underline">
                <Button variant="ghost" size="sm" className="text-[#0DD9D0] hover:text-[#0BBFB7] font-medium p-0 h-auto">
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
