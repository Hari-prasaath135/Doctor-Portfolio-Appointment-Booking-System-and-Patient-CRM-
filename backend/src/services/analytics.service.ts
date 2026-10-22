import { db, collections, admin } from '../config/firebase';
import { AnalyticsEvent, AnalyticsEventType } from '../types';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const VALID_EVENT_TYPES: Set<AnalyticsEventType> = new Set([
  'page_view',
  'appointment_page_view',
  'booking_started',
  'consultation_selected',
  'date_selected',
  'slot_selected',
  'booking_submitted',
  'booking_failed',
  'contact_form_submitted',
]);

const ALLOWED_PATHS = new Set([
  '/',
  '/about',
  '/services',
  '/procedures',
  '/testimonials',
  '/contact',
  '/book-appointment',
]);

export class AnalyticsService {
  /**
   * Records a validated, privacy-safe analytics event.
   * Strips all PII, rejects unknown event types, and records server-generated timestamp.
   */
  async recordEvent(input: {
    eventType: string;
    path: string;
    sessionId?: string;
    consultationType?: string;
    outcome?: 'success' | 'failure';
    eventId?: string;
  }): Promise<AnalyticsEvent> {
    const { eventType, path, sessionId, consultationType, outcome, eventId } = input;

    if (!eventType || !VALID_EVENT_TYPES.has(eventType as AnalyticsEventType)) {
      throw new ValidationError(`Invalid or unsupported analytics eventType: ${eventType}`);
    }

    // Path normalization and validation
    const normalizedPath = (path || '/').split('?')[0].trim();
    if (normalizedPath.length > 100 || !normalizedPath.startsWith('/')) {
      throw new ValidationError('Invalid path format');
    }

    // Session ID validation (anonymous random string, 10-64 chars)
    const validSessionId =
      sessionId && /^[a-zA-Z0-9_-]{10,64}$/.test(sessionId)
        ? sessionId
        : 'anon_' + Math.random().toString(36).substring(2, 12);

    // Consultation type validation (only allow known enums, no free text)
    const validConsultationType =
      consultationType && ['IN_PERSON', 'VIDEO', 'FOLLOW_UP'].includes(consultationType)
        ? consultationType
        : undefined;

    // Idempotency / Deduplication check via eventId
    const docId = eventId && /^[a-zA-Z0-9_-]{8,64}$/.test(eventId)
      ? eventId
      : db.collection(collections.analytics).doc().id;

    const eventRef = db.collection(collections.analytics).doc(docId);

    // Check if duplicate submission within a small window
    const existing = await eventRef.get();
    if (existing.exists) {
      return { id: existing.id, ...existing.data(), deduplicated: true } as AnalyticsEvent & { deduplicated?: boolean };
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const eventRecord: Omit<AnalyticsEvent, 'id'> = {
      eventType: eventType as AnalyticsEventType,
      path: normalizedPath,
      sessionId: validSessionId,
      ...(validConsultationType ? { consultationType: validConsultationType } : {}),
      ...(outcome && (outcome === 'success' || outcome === 'failure') ? { outcome } : {}),
      timestamp: now as FirebaseFirestore.Timestamp,
    };

    await eventRef.set(eventRecord);
    logger.debug(`Analytics event recorded: type=${eventType}, path=${normalizedPath}, session=${validSessionId}`);

    return { id: docId, ...eventRecord, deduplicated: false } as AnalyticsEvent & { deduplicated?: boolean };
  }
}

export const analyticsService = new AnalyticsService();
