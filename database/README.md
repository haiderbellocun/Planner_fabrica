# 🗄️ Migración a PostgreSQL Local

## Pasos para configurar la base de datos

### 1. Verificar que PostgreSQL esté corriendo

```bash
# En Windows, verifica el servicio
sc query postgresql-x64-14  # o la versión que tengas instalada
```

### 2. Ejecutar la migración principal

Conéctate a PostgreSQL y ejecuta:

```bash
psql -h localhost -p 5432 -U postgres -d pruebas_haider -f database/migration_local.sql
```

O desde pgAdmin o cualquier cliente SQL, ejecuta el archivo `migration_local.sql`

### 3. Insertar usuarios iniciales

```bash
psql -h localhost -p 5432 -U postgres -d pruebas_haider -f database/seed_users.sql
```

### 4. Verificar que todo esté correcto

Conéctate a la base de datos y ejecuta:

```sql
-- Ver todas las tablas creadas
\dt

-- Ver usuarios y sus roles
SELECT
    u.email,
    u.full_name,
    COALESCE(ur.role::TEXT, 'user') as rol,
    u.is_active as activo
FROM public.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
ORDER BY ur.role;
```

## Credenciales de inicio de sesión

### Super Administrador
- **Email:** `haider_bello@cun.edu.co`
- **Password:** `TaskFlow2024`

### Líderes de Proyecto
- **Email:** `deyvis_miranda@cun.edu.co` / **Password:** `TaskFlow2024`
- **Email:** `german_giraldo@cun.edu.co` / **Password:** `TaskFlow2024`
- **Email:** `nathaly_amaya@cun.edu.co` / **Password:** `TaskFlow2024`

## Agregar nuevos usuarios

Para agregar usuarios normales (sin rol de líder):

```sql
-- Activar extensión de encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insertar nuevo usuario
INSERT INTO public.users (email, password_hash, full_name, email_verified, is_active)
VALUES
    ('nuevo_usuario@cun.edu.co', crypt('SuContraseña123', gen_salt('bf')), 'Nombre Completo', true, true);
```

Para asignar rol de líder a un usuario existente:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'project_leader'::app_role
FROM public.profiles p
JOIN public.users u ON u.id = p.user_id
WHERE u.email = 'usuario@cun.edu.co';
```

## Estructura de roles

- **`admin`**: Super administrador con acceso total
- **`project_leader`**: Puede crear proyectos y asignar tareas
- **`user`**: Usuario normal que puede ser asignado a tareas

## Próximos pasos

1. ✅ Migraciones ejecutadas
2. ⏳ Configurar backend para conectarse a PostgreSQL
3. ⏳ Actualizar frontend para usar API local en lugar de Supabase
