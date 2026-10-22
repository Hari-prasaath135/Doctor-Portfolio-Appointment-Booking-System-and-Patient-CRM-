import axios from 'axios';
import { db, collections, admin } from '../config/firebase';
import { MeetingDetails, ZoomMeetingRequest, ZoomMeetingResponse } from '../types';
import { NotFoundError, ServiceUnavailableError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID!;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID!;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET!;

/**
 * Video Meeting Service — Zoom API Integration (Server-to-Server OAuth)
 *
 * Flow:
 *   Confirmed Appointment
 *         ↓
 *   Node.js Video Service
 *         ↓
 *   Zoom Server-to-Server OAuth → access token
 *         ↓
 *   Create Zoom Meeting via REST API
 *         ↓
 *   Store meeting details in Firestore
 *         ↓
 *   Return join URL + password to frontend
 */
export class VideoService {
  /**
   * Obtain a Zoom Server-to-Server OAuth access token.
   */
  private async getZoomToken(): Promise<string> {
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    try {
      const response = await axios.post<{ access_token: string }>(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
        {},
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return response.data.access_token;
    } catch (err) {
      logger.error('Failed to obtain Zoom access token', err);
      throw new ServiceUnavailableError('Zoom');
    }
  }

  /**
   * Create a Zoom meeting for a confirmed appointment.
   *
   * @param appointmentId  Appointment document ID
   * @param date           Appointment date (YYYY-MM-DD)
   * @param time           Appointment time (HH:mm)
   * @param topic          Meeting topic / title
   * @param durationMin    Duration in minutes (default 30)
   */
  async createMeeting(
    appointmentId: string,
    date: string,
    time: string,
    topic: string,
    durationMin = 30
  ): Promise<MeetingDetails> {
    // Prevent duplicate meeting creation
    const existingSnap = await db
      .collection(collections.meetingDetails)
      .where('appointmentId', '==', appointmentId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return { id: doc.id, ...doc.data() } as unknown as MeetingDetails;
    }

    const token = await this.getZoomToken();

    // Convert "YYYY-MM-DD" + "HH:mm" to ISO 8601 in Asia/Kolkata
    // Zoom expects UTC; IST is UTC+5:30
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute);
    const utcDate = new Date(localDate.getTime() - 5.5 * 60 * 60 * 1000);
    const startTimeISO = utcDate.toISOString().replace('.000Z', 'Z');

    const meetingRequest: ZoomMeetingRequest = {
      topic,
      type: 2,
      start_time: startTimeISO,
      duration: durationMin,
      timezone: 'Asia/Kolkata',
      agenda: `Medical consultation appointment #${appointmentId}`,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
      },
    };

    let zoomResponse: ZoomMeetingResponse;
    try {
      const res = await axios.post<ZoomMeetingResponse>(
        'https://api.zoom.us/v2/users/me/meetings',
        meetingRequest,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      zoomResponse = res.data;
    } catch (err) {
      logger.error('Zoom meeting creation failed', err);
      throw new ServiceUnavailableError('Zoom Meeting Service');
    }

    const meetingId = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const meeting: Omit<MeetingDetails, 'createdAt' | 'updatedAt'> & {
      createdAt: unknown;
      updatedAt: unknown;
    } = {
      id: meetingId,
      appointmentId,
      provider: 'ZOOM',
      meetingId: String(zoomResponse.id),
      meetingUrl: zoomResponse.join_url,
      hostUrl: zoomResponse.start_url,
      password: zoomResponse.password,
      startTime: zoomResponse.start_time,
      duration: zoomResponse.duration,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(collections.meetingDetails).doc(meetingId).set(meeting);

    logger.info(
      `Zoom meeting created: meetingDocId=${meetingId}, zoomId=${zoomResponse.id}, appointmentId=${appointmentId}`
    );

    return meeting as unknown as MeetingDetails;
  }

  /**
   * Get meeting details for an appointment.
   */
  async getMeetingByAppointment(appointmentId: string): Promise<MeetingDetails | null> {
    const snap = await db
      .collection(collections.meetingDetails)
      .where('appointmentId', '==', appointmentId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as MeetingDetails;
  }

  /**
   * Get meeting by document ID.
   */
  async getMeetingById(id: string): Promise<MeetingDetails> {
    const snap = await db.collection(collections.meetingDetails).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Meeting');
    return { id: snap.id, ...snap.data() } as unknown as MeetingDetails;
  }

  /**
   * Delete a Zoom meeting (e.g., on appointment cancellation).
   */
  async deleteMeeting(meetingDocId: string): Promise<void> {
    const meeting = await this.getMeetingById(meetingDocId);
    const token = await this.getZoomToken();

    try {
      await axios.delete(`https://api.zoom.us/v2/meetings/${meeting.meetingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      logger.info(`Zoom meeting ${meeting.meetingId} deleted`);
    } catch (err) {
      logger.warn(`Failed to delete Zoom meeting ${meeting.meetingId}`, err);
      // Don't throw — continue to clean up Firestore record
    }

    await db.collection(collections.meetingDetails).doc(meetingDocId).delete();
  }
}

export const videoService = new VideoService();
