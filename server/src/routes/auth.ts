import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, register, getCurrentUser, logout } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
// Rate limiting: máximo 10 intentos de login cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión, inténtalo de nuevo más tarde.' },
});

router.post('/login', loginLimiter, login);
router.post('/register', register);

// Protected routes
router.get('/me', authMiddleware, getCurrentUser);
router.post('/logout', authMiddleware, logout);

export default router;
