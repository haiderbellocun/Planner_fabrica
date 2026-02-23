import express from 'express';
import { listTemas, getTema, createTema, updateTema, deleteTema, } from '../controllers/temasController.js';
import { listMaterialesForTema, createMaterialRequeridoForTema, } from '../controllers/materialesController.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();
// All routes require authentication
router.use(authMiddleware);
// List temas for an asignatura
router.get('/asignaturas/:asignaturaId/temas', listTemas);
// Create tema
router.post('/asignaturas/:asignaturaId/temas', createTema);
// Get single tema
router.get('/temas/:id', getTema);
// Update tema
router.patch('/temas/:id', updateTema);
// Delete tema
router.delete('/temas/:id', deleteTema);
// Get materiales for a tema
router.get('/temas/:temaId/materiales', listMaterialesForTema);
// Add material to tema
router.post('/temas/:temaId/materiales', createMaterialRequeridoForTema);
export default router;
