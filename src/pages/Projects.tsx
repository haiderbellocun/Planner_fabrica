import { useState } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderKanban, Users, ListTodo, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreateProjectWizard } from '@/components/project/CreateProjectWizard';
import projectsImg from '@/assets/dashboard/projects.png';

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if user can create projects (admin or project_leader)
  const canCreateProject = user?.role === 'admin' || user?.role === 'project_leader';

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

      {projects.length === 0 ? (
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
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="relative h-full hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden">
                <img src={projectsImg} alt="" className="absolute bottom-0 right-0 h-24 w-24 object-contain opacity-20 pointer-events-none z-0" />
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
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 3).map((member) => (
                        <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                            {getInitials(member.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {project.members.length > 3 && (
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium border-2 border-card">
                          +{project.members.length - 3}
                        </div>
                      )}
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
