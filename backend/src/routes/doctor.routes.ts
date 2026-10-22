import { Router } from 'express';
import { doctorController } from '../controllers/doctor.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

// Publicly viewable list of doctors
router.get('/', doctorController.listDoctors);
router.get('/:id', doctorController.getDoctor);

// Admin / Doctor protected routes
router.post('/', authenticate, requireAdmin, doctorController.createDoctor);
router.put('/:id', authenticate, requireDoctorOrAdmin, doctorController.updateDoctor);
router.delete('/:id', authenticate, requireAdmin, doctorController.deactivateDoctor);

export default router;
