-- Get Deyvis profile
SELECT 'Deyvis Profile:' as info;
SELECT p.id, u.email, u.full_name FROM profiles p
JOIN users u ON u.id = p.user_id
WHERE u.email = 'deyvis_miranda@cun.edu.co';

-- Get completovs2 project
SELECT 'Project completovs2:' as info;
SELECT id, name FROM projects WHERE name = 'completovs2';

-- Check project members
SELECT 'Project Members:' as info;
SELECT pm.role, p.id as profile_id, u.email, u.full_name
FROM project_members pm
JOIN profiles p ON p.id = pm.user_id
JOIN users u ON u.id = p.user_id
WHERE pm.project_id = (SELECT id FROM projects WHERE name = 'completovs2');

-- Check if Deyvis is leader using function
SELECT 'Is Deyvis leader?' as info;
SELECT public.is_project_leader(
  (SELECT id FROM projects WHERE name = 'completovs2'),
  (SELECT p.id FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.email = 'deyvis_miranda@cun.edu.co')
) as is_leader;
