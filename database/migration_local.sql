-- =====================================================
-- TASKFLOW - PostgreSQL Local Migration
-- Base de datos: pruebas_haider
-- =====================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- =====================
-- AUTH USERS TABLE (Local replacement for Supabase Auth)
-- =====================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Create enum for app roles
-- =====================
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'project_leader', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for project member roles
DO $$ BEGIN
    CREATE TYPE public.project_role AS ENUM ('leader', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for task priority
DO $$ BEGIN
    CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for notification types
DO $$ BEGIN
    CREATE TYPE public.notification_type AS ENUM ('task_assigned', 'project_member_added', 'task_status_changed', 'task_commented', 'task_updated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- USER ROLES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    assigned_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- =====================
-- TASK STATUSES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.task_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6B7280',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default statuses (if not exists)
INSERT INTO public.task_statuses (name, description, color, display_order, is_default, is_completed)
SELECT * FROM (VALUES
    ('Pendiente', 'Tareas por iniciar', '#6B7280', 0, true, false),
    ('En Progreso', 'Tareas en desarrollo', '#3B82F6', 1, false, false),
    ('En Revisión', 'Tareas pendientes de revisión', '#F59E0B', 2, false, false),
    ('Completado', 'Tareas finalizadas', '#10B981', 3, false, true)
) AS v(name, description, color, display_order, is_default, is_completed)
WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses);

-- =====================
-- PROJECTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- =====================
-- PROJECT MEMBERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.project_members (
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
CREATE TABLE IF NOT EXISTS public.tasks (
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
-- TASK STATUS HISTORY TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.task_status_history (
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
-- TASK ACTIVITY LOG TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.task_activity_log (
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
CREATE TABLE IF NOT EXISTS public.notifications (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON public.task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON public.task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- =====================
-- HELPER FUNCTIONS
-- =====================

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
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
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members pm
        JOIN public.profiles p ON p.id = pm.user_id
        WHERE pm.project_id = project_uuid
        AND p.user_id = user_uuid
    );
$$;

-- Get profile id from user id
CREATE OR REPLACE FUNCTION public.get_profile_id(auth_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT id FROM public.profiles WHERE user_id = auth_user_id LIMIT 1;
$$;

-- =====================
-- TRIGGER: Create profile on user signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (NEW.id, NEW.full_name, NEW.email);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
    AFTER INSERT ON public.users
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

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
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

DROP TRIGGER IF EXISTS set_task_number ON public.tasks;
CREATE TRIGGER set_task_number
    BEFORE INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.generate_task_number();

-- =====================
-- TRIGGER: Track status changes
-- =====================
CREATE OR REPLACE FUNCTION public.track_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        -- Close previous status history
        UPDATE public.task_status_history
        SET ended_at = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
        WHERE task_id = NEW.id
        AND ended_at IS NULL;

        -- Create new status history
        INSERT INTO public.task_status_history (task_id, from_status_id, to_status_id, changed_by, started_at)
        VALUES (NEW.id, OLD.status_id, NEW.status_id, NEW.reporter_id, now());

        -- Log activity
        INSERT INTO public.task_activity_log (task_id, action, field_name, old_value, new_value, performed_by)
        SELECT
            NEW.id,
            'status_changed',
            'status',
            (SELECT name FROM public.task_statuses WHERE id = OLD.status_id),
            (SELECT name FROM public.task_statuses WHERE id = NEW.status_id),
            NEW.reporter_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_status_change ON public.tasks;
CREATE TRIGGER on_task_status_change
    AFTER UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.track_task_status_change();

-- =====================
-- TRIGGER: Create initial status history
-- =====================
CREATE OR REPLACE FUNCTION public.create_initial_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.task_status_history (task_id, from_status_id, to_status_id, changed_by, started_at)
    VALUES (NEW.id, NULL, NEW.status_id, NEW.reporter_id, now());

    INSERT INTO public.task_activity_log (task_id, action, performed_by)
    VALUES (NEW.id, 'task_created', NEW.reporter_id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_created ON public.tasks;
CREATE TRIGGER on_task_created
    AFTER INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.create_initial_status_history();

-- =====================
-- AUTHENTICATION FUNCTIONS
-- =====================

-- Verify user credentials
CREATE OR REPLACE FUNCTION public.verify_user_credentials(user_email TEXT, user_password TEXT)
RETURNS TABLE(user_id UUID, email TEXT, full_name TEXT, avatar_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.avatar_url
    FROM public.users u
    WHERE u.email = user_email
    AND u.password_hash = crypt(user_password, u.password_hash)
    AND u.is_active = true;
END;
$$;

-- Update last sign in
CREATE OR REPLACE FUNCTION public.update_last_sign_in(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.users
    SET last_sign_in_at = now()
    WHERE id = user_uuid;
END;
$$;

COMMENT ON TABLE public.users IS 'Local authentication users table';
COMMENT ON TABLE public.profiles IS 'User profiles with extended information';
COMMENT ON TABLE public.user_roles IS 'Application-level user roles (admin, project_leader, user)';
COMMENT ON TABLE public.projects IS 'Projects in the task management system';
COMMENT ON TABLE public.tasks IS 'Tasks with automatic time tracking';
COMMENT ON TABLE public.task_status_history IS 'History of task status changes for time tracking';
