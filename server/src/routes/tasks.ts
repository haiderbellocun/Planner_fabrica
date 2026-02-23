import express from 'express';
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskHistory,
  getTaskActivity,
} from '../controllers/tasksController.js';
import {
  getTaskComments,
  createTaskComment,
  deleteTaskComment,
} from '../controllers/commentsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware } from '../middleware/permissions.js';
import { validateTaskCreate, validateTaskUpdate } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get task history and activity (must be before /:id to avoid route conflict)
router.get('/:id/history', getTaskHistory);
router.get('/:id/activity', getTaskActivity);

// Task comments routes (must be before /:id)
router.get('/:id/comments', getTaskComments);
router.post('/:id/comments', createTaskComment);
router.delete('/:id/comments/:commentId', deleteTaskComment);

// Get single task
router.get('/:id', getTask);

// Update task status (specific endpoint)
router.patch('/:id/status', updateTaskStatus);

// Update task
router.patch('/:id', validateTaskUpdate, updateTask);

// Delete task (project leader only)
router.delete('/:id', projectLeaderMiddleware, deleteTask);

// These routes are mounted on /api/tasks but also need project context
// List tasks for project - will be mounted as /api/projects/:projectId/tasks
export const projectTasksRouter = express.Router({ mergeParams: true }); // mergeParams allows access to :projectId
projectTasksRouter.use(authMiddleware); // Apply auth middleware
projectTasksRouter.get('/', projectMemberMiddleware, listTasks);
projectTasksRouter.post('/', projectMemberMiddleware, validateTaskCreate, createTask);

export default router;
