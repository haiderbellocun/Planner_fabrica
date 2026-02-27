import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import tasksRoutes, { projectTasksRouter } from './routes/tasks.js';
import taskStatusesRoutes from './routes/taskStatuses.js';
import profilesRoutes from './routes/profiles.js';
import notificationsRoutes from './routes/notifications.js';
import programasRoutes from './routes/programas.js';
import asignaturasRoutes from './routes/asignaturas.js';
import temasRoutes from './routes/temas.js';
import materialesRoutes from './routes/materiales.js';
import temaAssigneesRoutes from './routes/temaAssignees.js';
import myTasksRoutes from './routes/myTasks.js';
import materialAssigneesRoutes from './routes/materialAssignees.js';
import tiemposRoutes from './routes/tiempos.js';
import reportsRoutes from './routes/reports.js';
import leadersRoutes from './routes/leaders.js';
import healthRoutes from './routes/health.js';
import pool from './config/database.js';
import { env } from './config/env.js';

const app = express();
const PORT = env.PORT;

// Health checks first (no middleware): GET /healthz, GET /readyz — must exist before any catch-all
app.use(healthRoutes);

// Middleware
// Parse CORS_ORIGIN: supports comma-separated list or '*'
const rawOrigin = env.CORS_ORIGIN.trim();
const corsOrigin: string | string[] | boolean =
  rawOrigin === '*'
    ? true                              // allow any — bracket avoids credentials conflict
    : rawOrigin.includes(',')
      ? rawOrigin.split(',').map(o => o.trim())
      : rawOrigin;

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,                   // JWT in Authorization header — no cookies needed
}));
// Handle OPTIONS preflight explicitly for all routes
app.options('*', cors({ origin: corsOrigin, credentials: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (avatars)
// In Docker (production) WORKDIR=/app so avatars are at /app/public/avatars.
// In local dev the process runs from server/ so we go one level up.
const avatarsPath =
  env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'public', 'avatars')
    : path.join(process.cwd(), '..', 'public', 'avatars');
app.use('/avatars', express.static(avatarsPath));

// Request logging middleware (dev only)
app.use((req, res, next) => {
  if (env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.path}`, {
      body: req.body,
      query: req.query,
    });
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);

// Mount project tasks routes FIRST (more specific route)
app.use('/api/projects/:projectId/tasks', projectTasksRouter);

// Then mount other routes
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/task-statuses', taskStatusesRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', programasRoutes);
app.use('/api', asignaturasRoutes);
app.use('/api', temasRoutes);
app.use('/api', materialesRoutes);
app.use('/api', temaAssigneesRoutes);
app.use('/api/my-tasks', myTasksRoutes);
app.use('/api', materialAssigneesRoutes);
app.use('/api/tiempos-estimados', tiemposRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/leaders', leadersRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }
  res.status(500).json({
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  if (env.NODE_ENV !== 'production') {
    console.log(`
╔═══════════════════════════════════════╗
║   🚀 Planner Fabrica API Started     ║
╠═══════════════════════════════════════╣
║   PORT: ${PORT.toString().padEnd(28)} ║
║   ENV:  ${env.NODE_ENV.padEnd(28)} ║
║   DB:   ${(env.PGDATABASE || env.DATABASE_URL || '').padEnd(28)} ║
╚═══════════════════════════════════════╝
    `);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  if (env.NODE_ENV !== 'production') {
    console.log('SIGTERM signal received: closing HTTP server');
  }
  pool.end(() => {
    if (env.NODE_ENV !== 'production') {
      console.log('Database pool closed');
    }
    process.exit(0);
  });
});
