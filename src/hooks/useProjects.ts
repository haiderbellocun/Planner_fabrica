import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Project, ProjectMember, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProjectWithDetails extends Project {
  members: (ProjectMember & { profile: Profile })[];
  tasks_count: number;
  members_count: number;
}

export function useProjects() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<ProjectWithDetails[]> => {
      const projects = await api.get<ProjectWithDetails[]>('/api/projects');
      return projects;
    },
    enabled: !!profile,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<ProjectWithDetails | null> => {
      if (!projectId) return null;
      const project = await api.get<ProjectWithDetails>(`/api/projects/${projectId}`);
      return project;
    },
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      key: string;
      start_date?: string;
      end_date?: string;
      tipo_programa?: 'profesional' | 'diplomado' | 'maestria' | 'doctorado';
      asignaturas?: Array<{
        name: string;
        code?: string;
        description?: string;
        materiales?: Array<{
          material_type_id: string;
          cantidad: number;
          descripcion?: string;
        }>;
      }>;
    }) => {
      if (!profile) throw new Error('No profile found');

      const project = await api.post<Project>('/api/projects', {
        name: data.name,
        description: data.description,
        key: data.key.toUpperCase(),
        start_date: data.start_date,
        end_date: data.end_date,
        tipo_programa: data.tipo_programa,
        asignaturas: data.asignaturas,
      });

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyecto creado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al crear proyecto: ' + error.message);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Project> & { id: string }) => {
      const project = await api.patch<Project>(`/api/projects/${id}`, data);
      return project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
      toast.success('Proyecto actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(`/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyecto eliminado');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });
}
