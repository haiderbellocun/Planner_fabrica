-- Fix is_project_member function to use profile_id instead of user_id
DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid);
CREATE FUNCTION public.is_project_member(project_uuid uuid, profile_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_uuid
        AND pm.user_id = profile_uuid
    );
$$;

-- Also fix is_project_leader function
DROP FUNCTION IF EXISTS public.is_project_leader(uuid, uuid);
CREATE FUNCTION public.is_project_leader(project_uuid uuid, profile_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_uuid
        AND pm.user_id = profile_uuid
        AND pm.role = 'leader'
    );
$$;

-- Verify the fix
SELECT public.is_project_member('b0bf115c-41cd-4a43-abc8-69343b31e03d'::UUID, '85e4d05a-d651-4540-836b-09d7cffccc32'::UUID) as is_member;
