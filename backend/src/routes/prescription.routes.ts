import { Router } from 'express';
import { prescriptionController } from '../controllers/prescription.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.post('/', requireDoctorOrAdmin, prescriptionController.createPrescription);
router.get('/:id', prescriptionController.getPrescription);
router.get('/patient/:patientId', prescriptionController.getPatientPrescriptions);
router.put('/:id', requireDoctorOrAdmin, prescriptionController.updatePrescription);

export default router;
