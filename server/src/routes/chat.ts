import express from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleChatMessage, getDailyBriefContext } from '../services/chatOrchestrator.js';

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { message, history = [] } = req.body as {
      message?: string;
      history?: Array<{ from: 'user' | 'lumina'; text: string }>;
    };

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
      history,
    });

    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error interno al procesar el mensaje del asistente.' });
  }
});

router.get('/daily-brief', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const brief = await getDailyBriefContext({
      id: req.user.id,
      profileId: req.user.profileId,
      email: req.user.email,
      role: req.user.role ?? null,
    });

    res.json({ brief });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Daily brief error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;

