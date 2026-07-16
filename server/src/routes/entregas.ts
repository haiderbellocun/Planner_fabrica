import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  listEntregas,
  createEntrega,
  updateEntrega,
  deleteEntrega,
} from '../controllers/entregasController.js';
import {
  getEntregaMateriales,
  setEntregaMateriales,
  getEntregaMaterialesResumen,
} from '../controllers/entregaMaterialesController.js';

const router = Router();

// All authenticated users can read
router.get('/', listEntregas);

// Only admin / project_leader can write
const leaderGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'project_leader') return next();
  return res.status(403).json({ error: 'Acceso denegado' });
};

router.post('/',     leaderGuard, createEntrega);
router.patch('/:id', leaderGuard, updateEntrega);
router.delete('/:id',leaderGuard, deleteEntrega);

// Detalle de materiales entregados por materia (para el dashboard de conteo)
router.get('/materiales',      getEntregaMaterialesResumen);
router.get('/:id/materiales',  getEntregaMateriales);
router.put('/:id/materiales',  leaderGuard, setEntregaMateriales);

export default router;
