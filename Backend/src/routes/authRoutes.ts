import { Router } from 'express';

import {
  changePassword,
  createAdminUser,
  getPasskeyLoginOptions,
  getPasskeyRegisterOptions,
  getMe,
  login,
  logout,
  refresh,
  verifyPasskeyLogin,
  verifyPasskeyRegister,
} from '../controllers/authController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/auth/login', login);
router.post('/auth/webauthn/login/options', getPasskeyLoginOptions);
router.post('/auth/webauthn/login/verify', verifyPasskeyLogin);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);
router.post('/auth/change-password', requireAuth, changePassword);
router.post('/auth/admin/users', requireAuth, requireAdmin, createAdminUser);
router.post('/auth/webauthn/register/options', requireAuth, getPasskeyRegisterOptions);
router.post('/auth/webauthn/register/verify', requireAuth, verifyPasskeyRegister);
router.get('/auth/me', requireAuth, getMe);

export default router;
