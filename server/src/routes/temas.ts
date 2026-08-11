import express from 'express';
import {
  listTemas,
  getTema,
  createTema,
  updateTema,
  deleteTema,
} from '../controllers/temasController.js';
import {
  listMaterialesForTema,
  createMaterialRequeridoForTema,
} from '../controllers/materialesController.js';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectLeaderOfResourceMiddleware } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const asignaturaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
  const result = await query('SELECT project_id FROM public.asignaturas WHERE id = $1', [req.params.asignaturaId]);
  return result.rows[0]?.project_id ?? null;
});

const temaLeaderMiddleware = projectLeaderOfResourceMiddleware(async (req) => {
  const result = await query(
    `SELECT a.project_id FROM public.temas t JOIN public.asignaturas a ON a.id = t.asignatura_id WHERE t.id = $1`,
    [req.params.id ?? req.params.temaId]
  );
  return result.rows[0]?.project_id ?? null;
});

// List temas for an asignatura
router.get('/asignaturas/:asignaturaId/temas', listTemas);

// Create tema (project leader only)
router.post('/asignaturas/:asignaturaId/temas', asignaturaLeaderMiddleware, createTema);

// Get single tema
router.get('/temas/:id', getTema);

// Update tema (project leader only)
router.patch('/temas/:id', temaLeaderMiddleware, updateTema);

// Delete tema (project leader only)
router.delete('/temas/:id', temaLeaderMiddleware, deleteTema);

// Get materiales for a tema
router.get('/temas/:temaId/materiales', listMaterialesForTema);

// Add material to tema (project leader only)
router.post('/temas/:temaId/materiales', temaLeaderMiddleware, createMaterialRequeridoForTema);

export default router;
