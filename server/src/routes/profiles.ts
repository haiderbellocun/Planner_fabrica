import express from 'express';
import { listProfiles, getProfile, updateCapacity } from '../controllers/profilesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// List all profiles
router.get('/', listProfiles);

// Get single profile
router.get('/:id', getProfile);

// Update weekly hours capacity (admin/project_leader for anyone, or a user for themselves)
router.patch('/:id/capacity', updateCapacity);

export default router;
