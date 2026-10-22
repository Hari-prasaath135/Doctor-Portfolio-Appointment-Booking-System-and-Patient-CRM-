import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

// Public first-party analytics ingestion (rate-limited / lightweight)
router.post('/events', analyticsController.recordEvent);

export default router;
