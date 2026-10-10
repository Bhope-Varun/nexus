import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
  listUsers,
} from '../controllers/auth.controller.ts';
import { authenticateToken, requireRoles } from '../middleware/auth.ts';
import { validate } from '../middleware/validate.ts';
import { authLimiter } from '../middleware/rateLimiter.ts';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  queryUsersSchema,
} from '../validators/auth.validator.ts';

const router = Router();

// Public auth routes
router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/logout', logout);

// Authenticated user routes
router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, validate({ body: updateProfileSchema }), updateMe);
router.post(
  '/change-password',
  authLimiter,
  authenticateToken,
  validate({ body: changePasswordSchema }),
  changePassword
);

// Admin & Staff only user management route with strict query validation
router.get(
  '/users',
  authenticateToken,
  requireRoles('admin', 'staff'),
  validate({ query: queryUsersSchema }),
  listUsers
);

export default router;
