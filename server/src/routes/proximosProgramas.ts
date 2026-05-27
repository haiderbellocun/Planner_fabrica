import express, { type Response, type NextFunction } from 'express';
import {
  listProximosProgramas,
  createProximoPrograma,
  updateProximoPrograma,
  deleteProximoPrograma,
} from '../controllers/proximosProgramasController.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Solo admin y project_leader pueden acceder
const leaderGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'project_leader') return next();
  return res.status(403).json({ error: 'Acceso denegado' });
};

router.use(leaderGuard);

router.get('/', listProximosProgramas);
router.post('/', createProximoPrograma);
router.patch('/:id', updateProximoPrograma);
router.delete('/:id', deleteProximoPrograma);

export default router;
