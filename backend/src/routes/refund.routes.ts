import { Router } from 'express';
import { refundController } from '../controllers/refund.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

// Request a refund (patient can request, but usually admin triggers)
router.post('/', refundController.requestRefund);
router.get('/:id', refundController.getRefund);
router.get('/appointment/:appointmentId', refundController.getRefundByAppointment);

export default router;
