import express from 'express';
import { listEquipos, updateEquipo, setEquipoMembers } from '../controllers/equiposController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', listEquipos);
router.patch('/:id', updateEquipo);
router.put('/:id/members', setEquipoMembers);

export default router;
