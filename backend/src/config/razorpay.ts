import Razorpay from 'razorpay';
import { logger } from '../utils/logger';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: 'test';
}

/**
 * Validates and returns Razorpay configuration strictly in TEST mode.
 * Fails closed if missing, invalid, or configured for live mode during Phase 3.
 */
export function getRazorpayConfig(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  const mode = (process.env.RAZORPAY_MODE || 'test').trim().toLowerCase();

  if (mode !== 'test') {
    throw new Error(
      'CRITICAL: RAZORPAY_MODE must be set to "test". Live payments are strictly prohibited in Phase 3.'
    );
  }

  if (!keyId) {
    throw new Error('CRITICAL: RAZORPAY_KEY_ID is missing in environment variables. Failing closed.');
  }

  if (!keySecret) {
    throw new Error('CRITICAL: RAZORPAY_KEY_SECRET is missing in environment variables. Failing closed.');
  }

  if (!webhookSecret) {
    throw new Error('CRITICAL: RAZORPAY_WEBHOOK_SECRET is missing in environment variables. Failing closed.');
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    mode: 'test',
  };
}

let razorpayClientInstance: any = null;

export function getRazorpayClient(): any {
  if (!razorpayClientInstance) {
    const config = getRazorpayConfig();
    razorpayClientInstance = new (Razorpay as any)({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });
    logger.info(`Initialized Razorpay client in TEST mode with Key ID: ${config.keyId.substring(0, 8)}...`);
  }
  return razorpayClientInstance;
}

export function setRazorpayClient(client: any): void {
  razorpayClientInstance = client;
}
