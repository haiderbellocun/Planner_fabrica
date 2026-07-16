import express from 'express';
import { listTeams, createTeam, updateTeam, deleteTeam, setTeamMembers } from '../controllers/teamsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { projectMemberMiddleware, projectLeaderMiddleware } from '../middleware/permissions.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', projectMemberMiddleware, listTeams);
router.post('/', projectLeaderMiddleware, createTeam);
router.patch('/:teamId', projectLeaderMiddleware, updateTeam);
router.delete('/:teamId', projectLeaderMiddleware, deleteTeam);
router.put('/:teamId/members', projectLeaderMiddleware, setTeamMembers);

export default router;
