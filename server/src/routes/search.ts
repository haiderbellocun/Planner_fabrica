import express from 'express';
import { search } from '../controllers/searchController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', search);

export default router;
