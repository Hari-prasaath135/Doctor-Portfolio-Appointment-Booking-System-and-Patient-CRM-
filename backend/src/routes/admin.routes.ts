import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.listUsers);
router.put('/users/:id/role', adminController.assignRole);
router.put('/users/:id/toggle', adminController.toggleUserAccount);
router.delete('/users/:id', adminController.deleteUser);

export default router;
