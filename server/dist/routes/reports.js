import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getOverview, getProjectsProgress, getTeamPerformance, getTeamCapacity, getMaterialProduction, getTimeDistribution, getWorkflowTransitions, getWorkloadByCargo, } from '../controllers/reportsController.js';
const router = Router();
// All report endpoints require authentication
router.use(authMiddleware);
router.get('/overview', getOverview);
router.get('/projects-progress', getProjectsProgress);
router.get('/team-performance', getTeamPerformance);
router.get('/team-capacity', getTeamCapacity);
router.get('/material-production', getMaterialProduction);
router.get('/time-distribution', getTimeDistribution);
router.get('/workflow-transitions', getWorkflowTransitions);
router.get('/workload-by-cargo', getWorkloadByCargo);
export default router;
