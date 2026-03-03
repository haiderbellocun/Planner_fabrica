import express from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleChatMessage } from '../services/chatOrchestrator.js';

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { message } = req.body as { message?: string };

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'El campo "message" es obligatorio.' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await handleChatMessage(message, {
      id: req.user.id,
      profileId: req.user.profileId,
      email: req.user.email,
      role: req.user.role,
    });

    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error interno al procesar el mensaje del asistente.' });
  }
});

export default router;

