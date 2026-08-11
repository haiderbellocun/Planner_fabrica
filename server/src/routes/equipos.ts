import express from 'express';
import { listEquipos, updateEquipo, setEquipoMembers } from '../controllers/equiposController.js';
import { listEquipoPlan, addEquipoPlanItem, removeEquipoPlanItem } from '../controllers/equipoPlanController.js';
import { authMiddleware } from '../middleware/auth.js';
import { planEditorMiddleware } from '../middleware/permissions.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', listEquipos);
router.patch('/:id', updateEquipo);
router.put('/:id/members', setEquipoMembers);

router.get('/:id/plan', listEquipoPlan);
router.post('/:id/plan/items', planEditorMiddleware, addEquipoPlanItem);
router.delete('/:id/plan/items/:itemId', planEditorMiddleware, removeEquipoPlanItem);

export default router;
