import type { Request, Response } from 'express';
import { pool } from '../config/database.js';

const SERVICE_NAME = 'planner-fabrica-api';

/**
 * GET /healthz — Liveness: process is up. No DB.
 */
export function getHealthz(_req: Request, res: Response) {
  res.status(200).json({ ok: true, service: SERVICE_NAME });
}

/**
 * GET /readyz — Readiness: DB is reachable.
 */
export async function getReadyz(_req: Request, res: Response) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true, db: 'up' });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
}
