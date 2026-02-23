-- Add project leaders as members to all existing projects where they are not already members

DO $$
DECLARE
    project_record RECORD;
    leader_id UUID;
    project_leaders UUID[] := ARRAY[
        '70a07114-c69b-43bc-ada3-411824c5e9f6'::UUID,  -- deyvis_miranda@cun.edu.co
        '6312b0b7-e3f1-4fa6-9993-41321bb629c2'::UUID,  -- german_giraldo@cun.edu.co
        '0d4c51ff-baa4-4932-9d44-939de1b66d27'::UUID   -- nathaly_amaya@cun.edu.co
    ];
BEGIN
    -- Loop through all projects
    FOR project_record IN SELECT id, name FROM public.projects LOOP
        RAISE NOTICE 'Processing project: %', project_record.name;

        -- Loop through project leaders
        FOREACH leader_id IN ARRAY project_leaders LOOP
            -- Check if already a member
            IF NOT EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_id = project_record.id
                AND user_id = leader_id
            ) THEN
                -- Add as member
                INSERT INTO public.project_members (
                    project_id,
                    user_id,
                    role,
                    can_view,
                    can_create,
                    can_edit,
                    can_assign
                )
                VALUES (
                    project_record.id,
                    leader_id,
                    'member',
                    true,
                    true,
                    true,
                    true
                );
                RAISE NOTICE '  Added project leader: %', leader_id;
            ELSE
                RAISE NOTICE '  Already a member: %', leader_id;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Process completed successfully';
END $$;

-- Verify the results
SELECT
    p.name as project_name,
    COUNT(pm.id) as total_members,
    STRING_AGG(pr.email, ', ') as members
FROM public.projects p
LEFT JOIN public.project_members pm ON pm.project_id = p.id
LEFT JOIN public.profiles pr ON pr.id = pm.user_id
GROUP BY p.id, p.name
ORDER BY p.created_at DESC;
