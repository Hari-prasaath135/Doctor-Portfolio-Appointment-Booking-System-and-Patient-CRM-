import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

// All appointment creation and management routes strictly require verified authentication
router.use(authenticate);

router.post('/', appointmentController.createAppointment);
router.get('/', appointmentController.listAppointments);
router.get('/:id', appointmentController.getAppointment);

router.put('/:id/confirm', requireDoctorOrAdmin, appointmentController.confirmAppointment);
router.put('/:id/complete', requireDoctorOrAdmin, appointmentController.completeAppointment);
router.put('/:id/cancel', appointmentController.cancelAppointment);
router.put('/:id/reschedule', appointmentController.rescheduleAppointment);

export default router;
