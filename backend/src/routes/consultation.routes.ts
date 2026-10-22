import { Router } from 'express';
import { consultationController } from '../controllers/consultation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.post('/', requireDoctorOrAdmin, consultationController.createConsultation);
router.get('/me', consultationController.getMyConsultations);
router.get('/:id', consultationController.getConsultation);
router.get('/appointment/:appointmentId', consultationController.getConsultationByAppointment);
router.put('/:id', requireDoctorOrAdmin, consultationController.updateConsultation);
router.put('/:id/complete', requireDoctorOrAdmin, consultationController.completeConsultation);

export default router;
