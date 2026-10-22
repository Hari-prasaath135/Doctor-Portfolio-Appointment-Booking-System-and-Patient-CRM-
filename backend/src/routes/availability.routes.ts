import { Router } from 'express';
import { availabilityController } from '../controllers/availability.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

// Publicly viewable available slots and dates
router.get('/slots', availabilityController.getAvailability);
router.get('/dates', availabilityController.getAvailableDates);

// Admin / Doctor protected routes
router.post('/', authenticate, requireDoctorOrAdmin, availabilityController.setAvailability);
router.post('/schedule', authenticate, requireDoctorOrAdmin, availabilityController.createSchedule);
router.post('/publish', authenticate, requireDoctorOrAdmin, availabilityController.togglePublish);
router.post('/block', authenticate, requireDoctorOrAdmin, availabilityController.blockSlot);
router.post('/leave', authenticate, requireDoctorOrAdmin, availabilityController.markLeave);

export default router;
