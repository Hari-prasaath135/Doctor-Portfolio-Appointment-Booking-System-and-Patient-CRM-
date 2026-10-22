import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.post('/verify', authenticate, authController.verify);
router.get('/me', authenticate, authController.getMe);
router.post('/register', authenticate, requireAdmin, authController.register);// Note: Registration might need an admin role depending on how you create doctors, but we'll leave it simple for now.
router.post('/revoke', authenticate, authController.revokeTokens);

export default router;
