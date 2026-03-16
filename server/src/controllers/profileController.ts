import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { uploadAvatarToGCS } from '../services/storageService.js';

interface MulterAuthRequest extends AuthRequest {
  file?: Express.Multer.File;
}

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    const mReq = req as MulterAuthRequest;
    const profileId = mReq.user?.profileId;
    if (!profileId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const check = await query(
      'SELECT avatar_changed_at FROM public.profiles WHERE id = $1',
      [profileId],
    );

    if (!check.rows[0]) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    if (check.rows[0].avatar_changed_at !== null) {
      return res.status(403).json({
        error:
          'Ya subiste tu foto de perfil. Solo se permite hacerlo una vez.',
      });
    }

    if (!mReq.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(mReq.file.mimetype)) {
      return res
        .status(400)
        .json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' });
    }

    if (mReq.file.size > 3 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: 'La imagen no puede superar 3MB' });
    }

    const publicUrl = await uploadAvatarToGCS(
      mReq.file.buffer,
      mReq.file.mimetype,
      profileId,
    );

    await query(
      `UPDATE public.profiles
       SET avatar_url = $1, avatar_changed_at = NOW()
       WHERE id = $2`,
      [publicUrl, profileId],
    );

    await query(
      'UPDATE public.users SET avatar_url = $1 WHERE id = (SELECT user_id FROM public.profiles WHERE id = $2)',
      [publicUrl, profileId],
    );

    res.json({ avatar_url: publicUrl });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.user?.profileId;
    if (!profileId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const result = await query(
      `SELECT p.id,
              p.full_name,
              p.avatar_url,
              p.cargo,
              p.avatar_changed_at,
              u.email,
              u.role
       FROM public.profiles p
       JOIN public.users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [profileId],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
};

