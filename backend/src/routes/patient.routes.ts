import { Router } from 'express';
import { patientController } from '../controllers/patient.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.post('/', authenticate, patientController.createPatient);
router.get('/me', authenticate, patientController.getMyProfile);
router.get('/', authenticate, requireAdmin, patientController.listPatients);
router.get('/:id', authenticate, patientController.getPatient);
router.put('/:id', authenticate, patientController.updatePatient);

export default router;
