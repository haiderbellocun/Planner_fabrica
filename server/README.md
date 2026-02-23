# 🚀 Planner Fabrica API Server

Backend API para Planner Fabrica - Fábrica de Contenido con Express + Node.js + PostgreSQL

## Instalación

```bash
cd server
bun install
```

## Configuración

Las variables de entorno ya están configuradas en `.env`:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=pruebas_haider
PGUSER=postgres
PGPASSWORD=postgres
PORT=3001
JWT_SECRET=taskflow-jwt-secret-change-in-production-2024
CORS_ORIGIN=http://localhost:5173
```

## Ejecutar el servidor

```bash
# Modo desarrollo (con hot reload)
bun run dev

# Modo producción
bun start
```

El servidor se ejecutará en **http://localhost:3001**

## Endpoints Disponibles

### Health Check
```
GET /health
```

### Autenticación

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "haider_bello@cun.edu.co",
  "password": "TaskFlow2024"
}
```

**Respuesta:**
```json
{
  "user": {
    "id": "uuid",
    "email": "haider_bello@cun.edu.co",
    "full_name": "Haider Bello",
    "avatar_url": null,
    "role": "admin"
  },
  "token": "jwt.token.here"
}
```

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "nuevo@cun.edu.co",
  "password": "password123",
  "full_name": "Nuevo Usuario"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## Estructura del Proyecto

```
server/
├── src/
│   ├── config/
│   │   └── database.ts      # Configuración de PostgreSQL
│   ├── controllers/
│   │   └── authController.ts # Controladores de autenticación
│   ├── middleware/
│   │   └── auth.ts           # Middleware de autenticación JWT
│   ├── routes/
│   │   └── auth.ts           # Rutas de autenticación
│   └── index.ts              # Servidor Express principal
├── .env                      # Variables de entorno
├── package.json
└── README.md
```

## Credenciales de Prueba

### Super Administrador
- Email: `haider_bello@cun.edu.co`
- Password: `TaskFlow2024`

### Líderes de Proyecto
- Email: `deyvis_miranda@cun.edu.co` / Password: `TaskFlow2024`
- Email: `german_giraldo@cun.edu.co` / Password: `TaskFlow2024`
- Email: `nathaly_amaya@cun.edu.co` / Password: `TaskFlow2024`

## Próximos Pasos

1. ✅ Configurar migraciones de base de datos
2. ✅ Crear backend API
3. ⏳ Actualizar frontend para usar API local
4. ⏳ Agregar endpoints para proyectos y tareas
