# 🚀 Planner Fabrica - Fábrica de Contenido

Sistema de gestión de proyectos y tareas para la Fábrica de Contenido con tablero Kanban, seguimiento automático de tiempo y roles de usuario.

## 📋 Características

- ✨ **Diseño Ejecutivo**: Inspirado en Content Factory con colores morados vibrantes
- 📊 **Tablero Kanban**: Gestión visual de tareas con drag & drop
- ⏱️ **Tracking Automático**: Registro de tiempo por cambio de estado
- 👥 **Sistema de Roles**: Admin, Project Leader y Usuario
- 🔐 **Autenticación JWT**: Segura y escalable
- 🎨 **Modo Oscuro/Claro**: Soporte completo
- 💾 **PostgreSQL Local**: Base de datos local sin dependencias cloud

## 🏗️ Arquitectura

- **Frontend**: React + TypeScript + Vite + TailwindCSS + Shadcn/ui
- **Backend**: Express + Bun + PostgreSQL
- **Base de Datos**: PostgreSQL 14+

## 📦 Requisitos Previos

- [Bun](https://bun.sh) instalado
- PostgreSQL 14+ instalado y corriendo
- Git

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <YOUR_GIT_URL>
cd app_planner
```

### 2. Configurar la Base de Datos

#### a) Ejecutar migraciones

```bash
# Ejecutar migración principal
psql -h localhost -p 5432 -U postgres -d pruebas_haider -f database/migration_local.sql

# Insertar usuarios iniciales
psql -h localhost -p 5432 -U postgres -d pruebas_haider -f database/seed_users.sql
```

#### b) Verificar instalación

```sql
psql -h localhost -p 5432 -U postgres -d pruebas_haider

-- Ver usuarios creados
SELECT u.email, u.full_name, COALESCE(ur.role::TEXT, 'user') as rol
FROM public.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
ORDER BY ur.role;
```

### 3. Configurar Backend API

```bash
cd server

# Instalar dependencias
bun install

# Verificar archivo .env (ya está configurado)
# Las credenciales de PostgreSQL ya están en server/.env

# Iniciar servidor
bun run dev
```

El servidor se ejecutará en **http://localhost:3001**

### 4. Configurar Frontend

```bash
# Volver a la raíz del proyecto
cd ..

# Instalar dependencias
bun install

# Verificar archivo .env (ya está configurado)
# La URL de la API ya está en .env

# Iniciar aplicación
bun dev
```

La aplicación se ejecutará en **http://localhost:5173**

## 🔑 Credenciales de Acceso

### Super Administrador
- **Email**: `haider_bello@cun.edu.co`
- **Password**: `TaskFlow2024`

### Líderes de Proyecto
- `deyvis_miranda@cun.edu.co` / `TaskFlow2024`
- `german_giraldo@cun.edu.co` / `TaskFlow2024`
- `nathaly_amaya@cun.edu.co` / `TaskFlow2024`

## 📝 Scripts Disponibles

### Frontend
```bash
bun dev          # Modo desarrollo
bun build        # Compilar para producción
bun preview      # Preview del build
```

### Backend
```bash
cd server
bun run dev      # Modo desarrollo con hot reload
bun start        # Modo producción
```

## 🎨 Paleta de Colores

- **Primario**: Morado vibrante (#5e19e6)
- **Sage**: Verde suave (#87a38d)
- **Sand**: Beige arena (#e3d5ca)
- **Lavender**: Lavanda claro (#e0d7f7)

## 📁 Estructura del Proyecto

```
app_planner/
├── src/                      # Frontend React
│   ├── components/           # Componentes UI
│   ├── contexts/             # Context providers (AuthContext)
│   ├── hooks/                # Custom hooks
│   ├── pages/                # Páginas de la app
│   └── integrations/         # (Legacy Supabase - no usado)
├── server/                   # Backend Express + Bun
│   ├── src/
│   │   ├── config/           # Configuración DB
│   │   ├── controllers/      # Controladores
│   │   ├── middleware/       # Middleware (auth JWT)
│   │   └── routes/           # Rutas API
│   └── .env                  # Variables de entorno
├── database/                 # Migraciones y seeds SQL
│   ├── migration_local.sql   # Migración principal
│   ├── seed_users.sql        # Usuarios iniciales
│   └── README.md             # Documentación DB
└── .env                      # Variables de entorno frontend
```

## 🔐 Sistema de Roles

### Admin (Super Administrador)
- Acceso total al sistema
- Gestión de usuarios y roles
- CRUD completo de proyectos y tareas

### Project Leader (Líder de Proyecto)
- Crear y gestionar proyectos
- Asignar tareas a usuarios
- Ver reportes de proyecto

### User (Usuario Normal)
- Ver tareas asignadas
- Actualizar estado de tareas propias
- Ver proyectos donde es miembro

## 🛠️ Tecnologías Utilizadas

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- Shadcn/ui
- Lucide React (íconos)
- React Router
- Framer Motion

### Backend
- Express.js
- Bun runtime
- PostgreSQL (pg)
- JWT (jsonwebtoken)
- bcryptjs

## 📚 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Proyectos (próximamente)
- `GET /api/projects` - Listar proyectos
- `POST /api/projects` - Crear proyecto
- `GET /api/projects/:id` - Obtener proyecto
- `PUT /api/projects/:id` - Actualizar proyecto
- `DELETE /api/projects/:id` - Eliminar proyecto

### Tareas (próximamente)
- `GET /api/tasks` - Listar tareas
- `POST /api/tasks` - Crear tarea
- `GET /api/tasks/:id` - Obtener tarea
- `PUT /api/tasks/:id` - Actualizar tarea
- `DELETE /api/tasks/:id` - Eliminar tarea

## 🐛 Troubleshooting

### Error: No se puede conectar a PostgreSQL
```bash
# Verificar que PostgreSQL esté corriendo
sc query postgresql-x64-14  # Windows

# Verificar credenciales en server/.env
```

### Error: Token inválido o expirado
- Cerrar sesión y volver a iniciar
- Verificar que el backend esté corriendo
- Limpiar localStorage del navegador

### Error: CORS
- Verificar que `CORS_ORIGIN` en `server/.env` sea `http://localhost:5173`
- Reiniciar el servidor backend

## 📄 Licencia

MIT

## 👨‍💻 Autor

Haider Bello - haider_bello@cun.edu.co

---

**¿Necesitas ayuda?** Revisa la documentación en `/database/README.md` y `/server/README.md`
