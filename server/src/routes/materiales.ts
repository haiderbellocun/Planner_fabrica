import express from 'express';
import {
  listMaterialTypes,
  listMaterialesForAsignatura,
  listMaterialesForTema,
  createMaterialRequerido,
  createMaterialRequeridoForTema,
  updateMaterialRequerido,
  deleteMaterialRequerido,
} from '../controllers/materialesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get material types catalog (available to all authenticated users)
router.get('/material-types', listMaterialTypes);

// Get materiales for an asignatura
router.get('/asignaturas/:asignaturaId/materiales', listMaterialesForAsignatura);

// Add material to asignatura
router.post('/asignaturas/:asignaturaId/materiales', createMaterialRequerido);

// Get materiales for a tema
router.get('/temas/:temaId/materiales', listMaterialesForTema);

// Add material to tema
router.post('/temas/:temaId/materiales', createMaterialRequeridoForTema);

// Update material requirement
router.patch('/materiales/:id', updateMaterialRequerido);

// Delete material requirement
router.delete('/materiales/:id', deleteMaterialRequerido);

export default router;
