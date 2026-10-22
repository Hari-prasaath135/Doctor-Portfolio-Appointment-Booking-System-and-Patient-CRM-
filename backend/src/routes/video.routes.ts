import { Router } from 'express';
import { videoController } from '../controllers/video.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.post('/:appointmentId/create', requireDoctorOrAdmin, videoController.createMeeting);
router.get('/:appointmentId', videoController.getMeeting);
router.delete('/:appointmentId', requireDoctorOrAdmin, videoController.deleteMeeting);

export default router;
