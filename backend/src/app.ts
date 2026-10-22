import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Route Imports
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';
import appointmentRoutes from './routes/appointment.routes';
import availabilityRoutes from './routes/availability.routes';
import paymentRoutes from './routes/payment.routes';
import refundRoutes from './routes/refund.routes';
import videoRoutes from './routes/video.routes';
import consultationRoutes from './routes/consultation.routes';
import prescriptionRoutes from './routes/prescription.routes';
import medicalHistoryRoutes from './routes/medicalHistory.routes';
import queryRoutes from './routes/query.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';

import { AppError } from './utils/errors';
import { logger } from './utils/logger';
import { paymentController } from './controllers/payment.controller';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));

// Parse JSON with rawBody buffer capture for webhook HMAC signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.post('/api/v1/webhooks/razorpay', (req, res, next) => {
  paymentController.handleRazorpayWebhook(req, res, next);
});
app.use('/api/v1/refunds', refundRoutes);
app.use('/api/v1/video', videoRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/medical-history', medicalHistoryRoutes);
app.use('/api/v1/queries', queryRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...((err as any).fields && { errors: (err as any).fields })
    });
    return;
  }
  
  logger.error('Unhandled Server Error', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

export default app;
