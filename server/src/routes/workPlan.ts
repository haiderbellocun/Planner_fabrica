import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { reportsAccessMiddleware } from '../middleware/permissions.js';
import {
  getSummary,
  getWorkload,
  getStatusDistribution,
  getEvolution,
  getPlannedVsCompleted,
  getStatusByCollaborator,
  getCollaboratorProjectMatrix,
  getProductionProgress,
  getProductionVelocity,
  getActivity,
  getCollaboratorRows,
  getCollaboratorDetail,
  getAlerts,
  getExecutiveTable,
  getFilterOptions,
} from '../controllers/workPlanController.js';

const router = Router();

router.use(authMiddleware);
router.use(reportsAccessMiddleware);

router.get('/filters', getFilterOptions);
router.get('/summary', getSummary);
router.get('/workload', getWorkload);
router.get('/status-distribution', getStatusDistribution);
router.get('/evolution', getEvolution);
router.get('/planned-vs-completed', getPlannedVsCompleted);
router.get('/status-by-collaborator', getStatusByCollaborator);
router.get('/collaborator-project-matrix', getCollaboratorProjectMatrix);
router.get('/production-progress', getProductionProgress);
router.get('/production-velocity', getProductionVelocity);
router.get('/activity', getActivity);
router.get('/collaborators', getCollaboratorRows);
router.get('/collaborator/:id', getCollaboratorDetail);
router.get('/alerts', getAlerts);
router.get('/table', getExecutiveTable);

export default router;
