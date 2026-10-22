import { Router } from 'express';
import { queryController } from '../controllers/query.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.post('/', queryController.submitQuery);
router.get('/', queryController.listQueries);
router.get('/:id', queryController.getQuery);
router.put('/:id/assign', requireDoctorOrAdmin, queryController.assignQuery);
router.put('/:id/resolve', requireDoctorOrAdmin, queryController.resolveQuery);
router.put('/:id/close', requireDoctorOrAdmin, queryController.closeQuery);

export default router;
