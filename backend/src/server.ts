import 'dotenv/config'; // Load env vars first
import app from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle graceful shutdown
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, shutting down gracefully...');
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
