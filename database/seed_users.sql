-- =====================================================
-- TASKFLOW - Seed Initial Users
-- Base de datos: pruebas_haider
-- =====================================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================
-- INSERT USERS
-- =====================
-- Password por defecto para todos: "TaskFlow2024"
-- (Pueden cambiarla después de iniciar sesión)

INSERT INTO public.users (email, password_hash, full_name, email_verified, is_active)
VALUES
    -- Super Administrador
    ('haider_bello@cun.edu.co', crypt('TaskFlow2024', gen_salt('bf')), 'Haider Bello', true, true),

    -- Líderes de Proyecto
    ('deyvis_miranda@cun.edu.co', crypt('TaskFlow2024', gen_salt('bf')), 'Deyvis Miranda', true, true),
    ('german_giraldo@cun.edu.co', crypt('TaskFlow2024', gen_salt('bf')), 'German Giraldo', true, true),
    ('nathaly_amaya@cun.edu.co', crypt('TaskFlow2024', gen_salt('bf')), 'Nathaly Amaya', true, true)
ON CONFLICT (email) DO NOTHING;

-- =====================
-- ASSIGN ROLES
-- =====================

-- Asignar rol de Admin a haider_bello
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
JOIN public.users u ON u.id = p.user_id
WHERE u.email = 'haider_bello@cun.edu.co'
ON CONFLICT (user_id, role) DO NOTHING;

-- Asignar rol de project_leader a los líderes
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'project_leader'::app_role
FROM public.profiles p
JOIN public.users u ON u.id = p.user_id
WHERE u.email IN (
    'deyvis_miranda@cun.edu.co',
    'german_giraldo@cun.edu.co',
    'nathaly_amaya@cun.edu.co'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================
-- VERIFICATION QUERY
-- =====================
-- Ver usuarios creados con sus roles
SELECT
    u.email,
    u.full_name,
    COALESCE(ur.role::TEXT, 'user') as rol,
    u.is_active as activo,
    u.created_at as creado_en
FROM public.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
ORDER BY
    CASE ur.role::TEXT
        WHEN 'admin' THEN 1
        WHEN 'project_leader' THEN 2
        ELSE 3
    END,
    u.email;

-- =====================
-- INSTRUCCIONES
-- =====================
/*
CREDENCIALES DE INICIO DE SESIÓN:

Super Administrador:
  Email: haider_bello@cun.edu.co
  Password: TaskFlow2024

Líderes de Proyecto:
  Email: deyvis_miranda@cun.edu.co
  Password: TaskFlow2024

  Email: german_giraldo@cun.edu.co
  Password: TaskFlow2024

  Email: nathaly_amaya@cun.edu.co
  Password: TaskFlow2024

NOTA: Se recomienda cambiar las contraseñas después del primer inicio de sesión.

Para agregar más usuarios normales, ejecuta:

INSERT INTO public.users (email, password_hash, full_name, email_verified, is_active)
VALUES
    ('nuevo_usuario@cun.edu.co', crypt('TaskFlow2024', gen_salt('bf')), 'Nombre Completo', true, true);

*/
