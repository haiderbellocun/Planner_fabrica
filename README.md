# 🚀 Planner Fábrica — Content Factory Management System

Aplicación web para la gestión de proyectos y tareas de una Fábrica de Contenido, con tablero Kanban, seguimiento automático de tiempos, control por roles y trazabilidad operativa.

![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Styles-TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Backend-Express-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-black)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📌 Descripción

**Planner Fábrica** es una aplicación diseñada para centralizar la operación de una Fábrica de Contenido, permitiendo gestionar proyectos, tareas, responsables, estados y tiempos de ejecución en una sola plataforma.

La solución está orientada a equipos que requieren visibilidad operativa, control del flujo de trabajo y una base sólida para evolucionar hacia reportes, analítica y automatización de procesos.

---

## ✨ Funcionalidades principales

- 📋 **Tablero Kanban** para gestión visual de tareas
- ⏱️ **Tracking automático de tiempo** por cambio de estado
- 👥 **Sistema de roles**: Admin, Project Leader y User
- 🔐 **Autenticación JWT**
- 🌙 **Modo oscuro / claro**
- 🧩 **Arquitectura desacoplada** entre frontend, backend y base de datos
- 🗂️ **Gestión centralizada** de proyectos y tareas
- 📈 Base preparada para evolución a dashboards y reportes operativos

---


---

## 🏗️ Arquitectura

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- React Router
- Framer Motion
- Lucide React

### Backend
- Express.js
- Bun runtime
- JWT
- bcryptjs

### Base de datos
- PostgreSQL 14+

---

## 📂 Estructura del proyecto

```bash
app_planner/
├── src/                         # Frontend React
│   ├── components/             # Componentes UI
│   ├── contexts/               # Context providers
│   ├── hooks/                  # Custom hooks
│   ├── pages/                  # Vistas y páginas
│   └── integrations/           # Integraciones legacy/no usadas
│
├── server/                     # Backend API
│   ├── src/
│   │   ├── config/             # Configuración de base de datos y app
│   │   ├── controllers/        # Lógica de negocio
│   │   ├── middleware/         # Middleware (auth, validaciones, etc.)
│   │   └── routes/             # Rutas API
│   └── .env.example
│
├── database/                   # Scripts SQL
│   ├── migration_local.sql     # Migración principal
│   ├── seed_users.sql          # Datos iniciales
│   └── README.md               # Documentación de base de datos
│
├── docs/                       # Documentación adicional
│   ├── architecture.md
│   ├── setup.md
│   ├── api.md
│   └── images/
│
├── .env.example                # Variables de entorno frontend
└── README.md

```
---

## Inicio rápido
1. Clonar repositorio
git clone <TU_REPOSITORIO>
cd app_planner

2. Configurar variables de entorno
cp .env.example .env
cp server/.env.example server/.env
---
## Variables de entorno
Frontend .env.example
VITE_API_URL=http://localhost:3001

## Backend server/.env.example
```
PORT=3001
JWT_SECRET=your_jwt_secret
DB_HOST=localhost
DB_PORT=5432
DB_NAME=planner_db
DB_USER=postgres
DB_PASSWORD=your_password
CORS_ORIGIN=http://localhost:5173
```
## Configuración de base de datos

Ejecuta la migración principal y luego el seed inicial:
```
psql -h localhost -p 5432 -U postgres -d planner_db -f database/migration_local.sql
psql -h localhost -p 5432 -U postgres -d planner_db -f database/seed_users.sql
```
## Ejecución del proyecto
Backend
```
cd server
bun install
bun run dev
```
## Frontend
```
cd ..
bun install
bun dev
```
---
## API principal
* POST /api/auth/login — Iniciar sesión
* POST /api/auth/register — Registrar usuario
* GET /api/auth/me — Obtener usuario autenticado
* POST /api/auth/logout — Cerrar sesión
# Proyectos 
* GET /api/projects — Listar proyectos
* POST /api/projects — Crear proyecto
* GET /api/projects/:id — Obtener proyecto por id
* PUT /api/projects/:id — Actualizar proyecto
* DELETE /api/projects/:id — Eliminar proyecto
## Tareas
* GET /api/tasks — Listar tareas
* POST /api/tasks — Crear tarea
* GET /api/tasks/:id — Obtener tarea por id
* PUT /api/tasks/:id — Actualizar tarea
* DELETE /api/tasks/:id — Eliminar tarea
---
## Roles del sistema
Admin
* Acceso total al sistema
* Gestión de usuarios y roles
* CRUD completo de proyectos y tareas
* Administración general de la plataforma
## Project Leader
* Crear y gestionar proyectos
* Asignar tareas a usuarios
* Supervisar avance del equipo
* Consultar reportes operativos del proyecto
## User
* Visualizar tareas asignadas
* Actualizar estados de trabajo
* Hacer seguimiento de actividades propias
---


