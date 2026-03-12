import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { reportsAccessMiddleware } from '../middleware/permissions.js';
import {
  getOverview,
  getProjectsProgress,
  getProjectsTimeline,
  getTeamPerformance,
  getTeamCapacity,
  getMaterialProduction,
  getTimeDistribution,
  getWorkflowTransitions,
  getWorkloadByCargo,
  getProjectCategoriesSummary,
  getTasksWeeklyTrend,
  getUserMiniReport,
  getTeamMonthlyCompletion,
  getTeamByCargo,
  getWeeklyByCargo,
  getUnassignedMaterials,
} from '../controllers/reportsController.js';

const router = Router();

// All report endpoints require authentication and admin or project_leader role
router.use(authMiddleware);
router.use(reportsAccessMiddleware);

router.get('/overview', getOverview);
router.get('/projects-progress', getProjectsProgress);
router.get('/projects-timeline', getProjectsTimeline);
router.get('/team-performance', getTeamPerformance);
router.get('/team-capacity', getTeamCapacity);
router.get('/material-production', getMaterialProduction);
router.get('/time-distribution', getTimeDistribution);
router.get('/workflow-transitions', getWorkflowTransitions);
router.get('/workload-by-cargo', getWorkloadByCargo);
router.get('/project-categories', getProjectCategoriesSummary);
router.get('/tasks-weekly-trend', getTasksWeeklyTrend);
router.get('/user-mini-report/:userId', getUserMiniReport);
router.get('/team-monthly-completion', getTeamMonthlyCompletion);
router.get('/team-by-cargo', getTeamByCargo);
router.get('/weekly-by-cargo', getWeeklyByCargo);
router.get('/unassigned-materials', getUnassignedMaterials);

export default router;
