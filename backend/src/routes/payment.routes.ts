import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireDoctorOrAdmin } from '../middleware/role.middleware';

const router = Router();

// Public Webhook route for Razorpay notifications
router.post('/webhooks/razorpay', paymentController.handleRazorpayWebhook);
router.post('/webhook', paymentController.handleRazorpayWebhook); // alias

// Protected Patient Payment routes
router.post('/orders', authenticate, paymentController.createOrder);
router.post('/order', authenticate, paymentController.createOrder); // Backward compatibility alias
router.post('/verify', authenticate, paymentController.verifyPayment);
router.get('/:id/status', authenticate, paymentController.getPaymentStatus);
router.get('/appointment/:appointmentId', authenticate, paymentController.getPaymentByAppointment);

// Periodic maintenance endpoint for reservation expiry (protected: admin or authorization header)
router.post('/cleanup-expired', (req, res, next) => {
  const cronSecret = req.headers['x-cron-secret'] || req.headers['x-webhook-secret'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret && cronSecret === webhookSecret) {
    return paymentController.cleanupExpiredReservations(req, res, next);
  }
  // Otherwise require standard authenticated ADMIN or DOCTOR role
  return authenticate(req, res, (err?: any) => {
    if (err) return next(err);
    return requireDoctorOrAdmin(req, res, (err2?: any) => {
      if (err2) return next(err2);
      paymentController.cleanupExpiredReservations(req, res, next);
    });
  });
});

export default router;
