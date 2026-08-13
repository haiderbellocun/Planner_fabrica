import express from 'express';
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  updateTaskRank,
  bulkUpdateTasks,
  deleteTask,
  getTaskHistory,
  getTaskActivity,
  listProjectTags,
} from '../controllers/tasksController.js';
import {
  getTaskComments,
  createTaskComment,
  deleteTaskComment,
} from '../controllers/commentsController.js';
import { searchTasksForPicker } from '../controllers/taskSearchController.js';
import { createSubtask } from '../controllers/subtasksController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware, planEditorMiddleware } from '../middleware/permissions.js';
import { validateTaskCreate, validateTaskUpdate, validateBulkTaskUpdate } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Cross-project task search for the weekly-plan picker (must be before /:id
// to avoid Express matching "search" as the :id param)
router.get('/search', planEditorMiddleware, searchTasksForPicker);

// Bulk status/assignee/sprint update, single project at a time (must be
// before PATCH /:id to avoid Express matching "bulk" as the :id param)
router.patch('/bulk', validateBulkTaskUpdate, bulkUpdateTasks);

// Get task history and activity (must be before /:id to avoid route conflict)
router.get('/:id/history', getTaskHistory);
router.get('/:id/activity', getTaskActivity);

// Task comments routes (must be before /:id)
router.get('/:id/comments', getTaskComments);
router.post('/:id/comments', createTaskComment);
router.delete('/:id/comments/:commentId', deleteTaskComment);

// Create a subtask of :id
router.post('/:id/subtasks', createSubtask);

// Get single task
router.get('/:id', getTask);

// Update task status (specific endpoint)
router.patch('/:id/status', updateTaskStatus);

// Reorder task within its board column or backlog
router.patch('/:id/rank', updateTaskRank);

// Update task
router.patch('/:id', validateTaskUpdate, updateTask);

// Delete task (project leader only)
router.delete('/:id', projectLeaderMiddleware, deleteTask);

// These routes are mounted on /api/tasks but also need project context
// List tasks for project - will be mounted as /api/projects/:projectId/tasks
export const projectTasksRouter = express.Router({ mergeParams: true }); // mergeParams allows access to :projectId
projectTasksRouter.use(authMiddleware); // Apply auth middleware
projectTasksRouter.get('/tags', projectMemberMiddleware, listProjectTags);
projectTasksRouter.get('/', projectMemberMiddleware, listTasks);
projectTasksRouter.post('/', projectMemberMiddleware, validateTaskCreate, createTask);

export default router;
