import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { uploadAvatar, getMyProfile } from '../controllers/profileController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

router.get('/me', authMiddleware, getMyProfile);
router.post('/avatar', authMiddleware, upload.single('avatar'), uploadAvatar);

export default router;

