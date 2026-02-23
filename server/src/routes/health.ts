import { Router } from 'express';
import { getHealthz, getReadyz } from '../controllers/healthController.js';

const router = Router();

// Liveness: /healthz and /healthz/ (no auth, no DB)
router.get('/healthz', getHealthz);
router.get('/healthz/', getHealthz);

// Readiness: /readyz and /readyz/ (no auth, DB check)
router.get('/readyz', getReadyz);
router.get('/readyz/', getReadyz);

export default router;
