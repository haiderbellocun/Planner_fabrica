import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  listSolicitudes,
  createSolicitud,
  updateSolicitud,
  deleteSolicitud,
} from '../controllers/solicitudesMarketingController.js';

const router = Router();

// All authenticated users can read
router.get('/', listSolicitudes);

// Only admin / project_leader can write
const leaderGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'project_leader') return next();
  return res.status(403).json({ error: 'Acceso denegado' });
};

router.post('/', leaderGuard, createSolicitud);
router.patch('/:id', leaderGuard, updateSolicitud);
router.delete('/:id', leaderGuard, deleteSolicitud);

export default router;
