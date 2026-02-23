import express from 'express';
import { listProfiles, getProfile } from '../controllers/profilesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// List all profiles
router.get('/', listProfiles);

// Get single profile
router.get('/:id', getProfile);

export default router;
