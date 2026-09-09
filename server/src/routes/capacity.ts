import { Router } from 'express';
import { getMyCapacity } from '../controllers/capacityController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Cualquier usuario autenticado puede ver su propia carga por horas.
router.get('/me', getMyCapacity);

export default router;
