import express from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  completeProject,
} from '../controllers/projectsController.js';
import { pinProject, unpinProject } from '../controllers/projectPinsController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import {
  projectMemberMiddleware,
  projectLeaderMiddleware,
  canCreateProjectMiddleware,
} from '../middleware/permissions.js';
import { validateProjectCreate, validateProjectUpdate } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// List all projects (user's projects)
router.get('/', listProjects);

// Get single project (requires membership)
router.get('/:id', projectMemberMiddleware, getProject);

// Create project (admin or project_leader only)
router.post('/', canCreateProjectMiddleware, validateProjectCreate, createProject);

// Update project (project leader only)
router.patch('/:id', projectLeaderMiddleware, validateProjectUpdate, updateProject);

// Mark project as completed (project leader or admin)
router.post('/:id/complete', projectLeaderMiddleware, completeProject);

// Delete project (admin only)
router.delete('/:id', adminMiddleware, deleteProject);

// Add member to project (project leader only)
router.post('/:id/members', projectLeaderMiddleware, addMember);

// Pin/unpin a project for the current user only (personal, not project management)
router.post('/:id/pin', projectMemberMiddleware, pinProject);
router.delete('/:id/pin', projectMemberMiddleware, unpinProject);

export default router;
