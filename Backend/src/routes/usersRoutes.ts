import { Router } from 'express';

import {
  createUser,
  deleteUser,
  getUsers,
  updateUserStatus,
} from '../controllers/usersController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/users', requireAuth, requireRole('SYS_ADMIN'), getUsers);
router.post('/users', requireAuth, requireRole('SYS_ADMIN'), createUser);
router.patch('/users/:userId/status', requireAuth, requireRole('SYS_ADMIN'), updateUserStatus);
router.delete('/users/:userId', requireAuth, requireRole('SYS_ADMIN'), deleteUser);

export default router;
