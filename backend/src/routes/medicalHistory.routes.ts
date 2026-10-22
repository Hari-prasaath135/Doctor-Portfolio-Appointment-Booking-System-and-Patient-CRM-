import { Router } from 'express';
import { medicalHistoryController } from '../controllers/medicalHistory.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', medicalHistoryController.addRecord);
router.get('/:id', medicalHistoryController.getRecord);
router.get('/patient/:patientId', medicalHistoryController.getPatientHistory);
router.put('/:id', medicalHistoryController.updateRecord);
router.delete('/:id', medicalHistoryController.deleteRecord);

export default router;
