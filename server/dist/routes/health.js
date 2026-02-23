import { Router } from 'express';
import { getHealthz, getReadyz } from '../controllers/healthController.js';
const router = Router();
router.get('/healthz', getHealthz);
router.get('/readyz', getReadyz);
export default router;
