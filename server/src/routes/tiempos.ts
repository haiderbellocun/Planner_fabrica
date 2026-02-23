import express from 'express';
import {
  getTiemposEstimados,
  calcularTiempo,
  calcularTiempoTarea,
  getProductos,
  getCargos,
} from '../controllers/tiemposController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/tiempos-estimados - List all timing rules (with optional filters)
router.get('/', getTiemposEstimados);

// GET /api/tiempos-estimados/productos - List unique product names
router.get('/productos', getProductos);

// GET /api/tiempos-estimados/cargos - List unique cargo names
router.get('/cargos', getCargos);

// GET /api/tiempos-estimados/calcular - Calculate estimated time
router.get('/calcular', calcularTiempo);

// GET /api/tiempos-estimados/tarea/:taskId - Calculate time for a specific task
router.get('/tarea/:taskId', calcularTiempoTarea);

export default router;
