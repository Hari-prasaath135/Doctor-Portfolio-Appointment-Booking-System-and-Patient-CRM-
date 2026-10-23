import 'dotenv/config'; // Load env vars first
import app from './app';
import { logger } from './utils/logger';
import { notificationService } from './services/notification.service';

const PORT = process.env.PORT || 5000;

const runNotificationOutbox = (): void => {
  void notificationService.processOutboxQueue()
    .then(({ processed, failures }) => {
      if (processed > 0 || failures > 0) {
        logger.info(`Notification outbox processed=${processed}, failures=${failures}`);
      }
    })
    .catch((error) => logger.error('Notification outbox worker failed', error));
};

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  runNotificationOutbox();
});

// Retry pending/retryable email notifications even when no new payment webhook arrives.
const notificationOutboxTimer = setInterval(runNotificationOutbox, 30_000);
notificationOutboxTimer.unref();

// Handle graceful shutdown
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, shutting down gracefully...');
  clearInterval(notificationOutboxTimer);
  server.close(() => {
    logger.info('Closed out remaining connections.');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
