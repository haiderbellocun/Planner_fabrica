// Database types for the project management application

export type AppRole = 'admin' | 'project_leader' | 'user';
export type ProjectRole = 'leader' | 'member';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationType = 'task_assigned' | 'project_member_added' | 'task_status_changed' | 'task_commented' | 'task_updated';
export type TipoPrograma = 'profesional' | 'diplomado' | 'maestria' | 'doctorado';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  cargo: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  created_at: string;
}

export interface TaskStatus {
  id: string;
  name: string;
  description: string | null;
  color: string;
  display_order: number;
  is_default: boolean;
  is_completed: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  key: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  owner_id: string | null;
  tipo_programa: TipoPrograma | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_assign: boolean;
  invited_by: string | null;
  joined_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status_id: string;
  assignee_id: string | null;
  reporter_id: string | null;
  start_date: string | null;
  due_date: string | null;
  tags: string[];
  task_number: number | null;
  material_requerido_id: string | null;
  asignatura_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  // Populated by joins
  material?: {
    id: string;
    descripcion: string | null;
    material_type: {
      id: string;
      name: string;
      icon: string | null;
    };
  } | null;
  tema?: {
    id: string;
    title: string;
  } | null;
  asignatura?: {
    id: string;
    name: string;
    code: string | null;
    semestre: number | null;
  } | null;
  programa?: {
    id: string;
    name: string;
    code: string | null;
    tipo_programa: string | null;
  } | null;
  // All temas and materiales for the asignatura (for task detail view)
  temas_materiales?: Array<{
    id: string;
    title: string;
    assignee?: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      email: string;
    } | null;
    materiales: Array<{
      id: string;
      material_type: {
        id: string;
        name: string;
        icon: string | null;
      };
      descripcion: string | null;
    }>;
  }>;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  from_status_id: string | null;
  to_status_id: string;
  changed_by: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface TaskActivityLog {
  id: string;
  task_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Extended types with relations
export interface TaskWithRelations extends Task {
  status?: TaskStatus;
  assignee?: Profile;
  reporter?: Profile;
  project?: Project;
}

export interface ProjectWithMembers extends Project {
  members?: (ProjectMember & { profile?: Profile })[];
  tasks_count?: number;
}

export interface TaskStatusHistoryWithRelations extends TaskStatusHistory {
  from_status?: TaskStatus;
  to_status?: TaskStatus;
  changed_by_profile?: Profile;
}

// Content Factory types
export interface Asignatura {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  created_at: string;
}

export interface MaterialRequerido {
  id: string;
  asignatura_id: string;
  material_type_id: string;
  cantidad: number;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface AsignaturaWithMateriales extends Asignatura {
  materiales?: (MaterialRequerido & { material_type?: MaterialType })[];
}

export interface ProjectWithContent extends Project {
  asignaturas?: AsignaturaWithMateriales[];
  asignaturas_count?: number;
  materiales_count?: number;
}
