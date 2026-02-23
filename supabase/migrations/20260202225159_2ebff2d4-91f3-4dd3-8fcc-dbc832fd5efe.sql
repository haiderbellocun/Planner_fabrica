-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'project_leader', 'user');

-- Create enum for project member roles
CREATE TYPE public.project_role AS ENUM ('leader', 'member');

-- Create enum for task priority
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create enum for notification types
CREATE TYPE public.notification_type AS ENUM ('task_assigned', 'project_member_added', 'task_status_changed', 'task_commented', 'task_updated');

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- USER ROLES TABLE (separate from profiles for security)
-- =====================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    assigned_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- =====================
-- TASK STATUSES TABLE (workflow states)
-- =====================
CREATE TABLE public.task_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6B7280',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default statuses
INSERT INTO public.task_statuses (name, description, color, display_order, is_default, is_completed) VALUES
('Pendiente', 'Tareas por iniciar', '#6B7280', 0, true, false),
('En Progreso', 'Tareas en desarrollo', '#3B82F6', 1, false, false),
('En Revisión', 'Tareas pendientes de revisión', '#F59E0B', 2, false, false),
('Completado', 'Tareas finalizadas', '#10B981', 3, false, true);

-- =====================
-- PROJECTS TABLE
-- =====================
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- PROJECT MEMBERS TABLE
-- =====================
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role project_role NOT NULL DEFAULT 'member',
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_create BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_assign BOOLEAN NOT NULL DEFAULT false,
    invited_by UUID REFERENCES public.profiles(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- =====================
-- TASKS TABLE
-- =====================
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority task_priority NOT NULL DEFAULT 'medium',
    status_id UUID REFERENCES public.task_statuses(id) NOT NULL,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE,
    due_date DATE,
    tags TEXT[] DEFAULT '{}',
    task_number INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- TASK STATUS HISTORY TABLE (for time tracking)
-- =====================
CREATE TABLE public.task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    from_status_id UUID REFERENCES public.task_statuses(id),
    to_status_id UUID REFERENCES public.task_statuses(id) NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- TASK ACTIVITY LOG TABLE (audit)
-- =====================
CREATE TABLE public.task_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- NOTIFICATIONS TABLE
-- =====================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status_id ON public.tasks(status_id);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at);
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX idx_task_status_history_task_id ON public.task_status_history(task_id);
CREATE INDEX idx_task_activity_log_task_id ON public.task_activity_log(task_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- =====================
-- HELPER FUNCTIONS
-- =====================

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE p.user_id = user_uuid AND ur.role = 'admin'
    );
$$;

-- Check if user is project leader
CREATE OR REPLACE FUNCTION public.is_project_leader(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members pm
        JOIN public.profiles p ON p.id = pm.user_id
        WHERE pm.project_id = project_uuid 
        AND p.user_id = user_uuid 
        AND pm.role = 'leader'
    );
$$;

-- Check if user is project member
CREATE OR REPLACE FUNCTION public.is_project_member(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members pm
        JOIN public.profiles p ON p.id = pm.user_id
        WHERE pm.project_id = project_uuid 
        AND p.user_id = user_uuid
    );
$$;

-- Get profile id from auth user id
CREATE OR REPLACE FUNCTION public.get_profile_id(auth_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.profiles WHERE user_id = auth_user_id LIMIT 1;
$$;

-- =====================
-- TRIGGER: Create profile on signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- TRIGGER: Update timestamps
-- =====================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================
-- TRIGGER: Auto-generate task number
-- =====================
CREATE OR REPLACE FUNCTION public.generate_task_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(task_number), 0) + 1 INTO next_number
    FROM public.tasks
    WHERE project_id = NEW.project_id;
    
    NEW.task_number = next_number;
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_task_number
    BEFORE INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.generate_task_number();

-- =====================
-- TRIGGER: Track status changes and calculate time
-- =====================
CREATE OR REPLACE FUNCTION public.track_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    last_history_record RECORD;
    duration_secs INTEGER;
BEGIN
    -- Only process if status actually changed
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        -- Close the previous status history entry
        UPDATE public.task_status_history
        SET ended_at = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
        WHERE task_id = NEW.id 
        AND ended_at IS NULL;
        
        -- Create new status history entry
        INSERT INTO public.task_status_history (task_id, from_status_id, to_status_id, changed_by, started_at)
        VALUES (NEW.id, OLD.status_id, NEW.status_id, public.get_profile_id(auth.uid()), now());
        
        -- Log the activity
        INSERT INTO public.task_activity_log (task_id, action, field_name, old_value, new_value, performed_by)
        SELECT 
            NEW.id, 
            'status_changed', 
            'status',
            (SELECT name FROM public.task_statuses WHERE id = OLD.status_id),
            (SELECT name FROM public.task_statuses WHERE id = NEW.status_id),
            public.get_profile_id(auth.uid());
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_status_change
    AFTER UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.track_task_status_change();

-- =====================
-- TRIGGER: Create initial status history on task creation
-- =====================
CREATE OR REPLACE FUNCTION public.create_initial_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.task_status_history (task_id, from_status_id, to_status_id, changed_by, started_at)
    VALUES (NEW.id, NULL, NEW.status_id, public.get_profile_id(auth.uid()), now());
    
    -- Log creation activity
    INSERT INTO public.task_activity_log (task_id, action, performed_by)
    VALUES (NEW.id, 'task_created', public.get_profile_id(auth.uid()));
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_created
    AFTER INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.create_initial_status_history();

-- =====================
-- ENABLE RLS
-- =====================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES: Profiles
-- =====================
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================
-- RLS POLICIES: User Roles
-- =====================
CREATE POLICY "Admins can manage user roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = public.get_profile_id(auth.uid()));

-- =====================
-- RLS POLICIES: Task Statuses
-- =====================
CREATE POLICY "Authenticated users can view statuses"
    ON public.task_statuses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage statuses"
    ON public.task_statuses FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- =====================
-- RLS POLICIES: Projects
-- =====================
CREATE POLICY "Users can view projects they are members of"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_member(id, auth.uid())
    );

CREATE POLICY "Admins and leaders can create projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin(auth.uid()) OR
        owner_id = public.get_profile_id(auth.uid())
    );

CREATE POLICY "Admins and project leaders can update projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(id, auth.uid())
    );

CREATE POLICY "Admins can delete projects"
    ON public.projects FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- =====================
-- RLS POLICIES: Project Members
-- =====================
CREATE POLICY "Users can view project members"
    ON public.project_members FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_member(project_id, auth.uid())
    );

CREATE POLICY "Leaders can add project members"
    ON public.project_members FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(project_id, auth.uid()) OR
        (user_id = public.get_profile_id(auth.uid()) AND invited_by = public.get_profile_id(auth.uid()))
    );

CREATE POLICY "Leaders can update project members"
    ON public.project_members FOR UPDATE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(project_id, auth.uid())
    );

CREATE POLICY "Leaders can remove project members"
    ON public.project_members FOR DELETE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(project_id, auth.uid())
    );

-- =====================
-- RLS POLICIES: Tasks
-- =====================
CREATE POLICY "Users can view tasks in their projects"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_member(project_id, auth.uid())
    );

CREATE POLICY "Members with permission can create tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(project_id, auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.profiles p ON p.id = pm.user_id
            WHERE pm.project_id = project_id
            AND p.user_id = auth.uid()
            AND pm.can_create = true
        )
    );

CREATE POLICY "Members with permission can update tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(project_id, auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.profiles p ON p.id = pm.user_id
            WHERE pm.project_id = project_id
            AND p.user_id = auth.uid()
            AND (pm.can_edit = true OR assignee_id = p.id)
        )
    );

CREATE POLICY "Leaders can delete tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        public.is_project_leader(project_id, auth.uid())
    );

-- =====================
-- RLS POLICIES: Task Status History
-- =====================
CREATE POLICY "Users can view status history of their project tasks"
    ON public.task_status_history FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_id
            AND public.is_project_member(t.project_id, auth.uid())
        )
    );

CREATE POLICY "System can insert status history"
    ON public.task_status_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "System can update status history"
    ON public.task_status_history FOR UPDATE
    TO authenticated
    USING (true);

-- =====================
-- RLS POLICIES: Task Activity Log
-- =====================
CREATE POLICY "Users can view activity of their project tasks"
    ON public.task_activity_log FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_id
            AND public.is_project_member(t.project_id, auth.uid())
        )
    );

CREATE POLICY "System can insert activity logs"
    ON public.task_activity_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =====================
-- RLS POLICIES: Notifications
-- =====================
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = public.get_profile_id(auth.uid()));

CREATE POLICY "System can create notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (user_id = public.get_profile_id(auth.uid()));