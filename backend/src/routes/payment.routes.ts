import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Webhook must be public for Pinelabs to hit
router.post('/webhook', paymentController.handleWebhook);

// Protected routes
router.use(authenticate);
router.post('/order', paymentController.createOrder);
router.get('/:id', paymentController.getPayment);
router.get('/appointment/:appointmentId', paymentController.getPaymentByAppointment);

export default router;
