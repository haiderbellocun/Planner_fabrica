import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listUsers, createUser, updateUserActive } from '../controllers/adminUsersController.js';

const router = express.Router();

// Todas requieren usuario autenticado
router.use(authMiddleware);

router.get('/users', listUsers);
router.post('/users', createUser);
router.patch('/users/:id/active', updateUserActive);

export default router;

