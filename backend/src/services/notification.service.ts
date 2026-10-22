import nodemailer from 'nodemailer';
import { db, collections, admin } from '../config/firebase';
import { Notification, NotificationType } from '../types';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

// ─── Gmail / Nodemailer Configuration ─────────────────────────────────────────

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

const transporter =
  EMAIL_USER && EMAIL_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASSWORD,
        },
      })
    : null;

const EMAIL_FROM = `${process.env.EMAIL_FROM_NAME || 'Dr. Vijay Clinic'} <${
  EMAIL_USER || 'clinic@drVijay.com'
}>`;

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildEmailHtml(
  title: string,
  body: string,
  ctaUrl?: string,
  ctaLabel?: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      margin: 0;
      padding: 0;
    }

    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }

    .header {
      background: linear-gradient(135deg, #0f4c81 0%, #1a73e8 100%);
      padding: 32px 40px;
    }

    .header h1 {
      color: #ffffff;
      font-size: 22px;
      margin: 0;
      font-weight: 600;
    }

    .header p {
      color: rgba(255,255,255,0.8);
      font-size: 13px;
      margin: 4px 0 0;
    }

    .body {
      padding: 36px 40px;
    }

    .body h2 {
      color: #111827;
      font-size: 20px;
      margin: 0 0 12px;
    }

    .body p {
      color: #4b5563;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 16px;
    }

    .cta {
      display: inline-block;
      margin-top: 8px;
      padding: 14px 28px;
      background: #1a73e8;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
    }

    .footer {
      background: #f3f4f6;
      padding: 20px 40px;
      text-align: center;
    }

    .footer p {
      color: #9ca3af;
      font-size: 12px;
      margin: 0;
    }
  </style>
</head>

<body>
  <div class="wrapper">

    <div class="header">
      <h1>Dr. Vijay Clinic</h1>
      <p>Interventional Radiology · Minimally Invasive Care</p>
    </div>

    <div class="body">
      <h2>${title}</h2>
      ${body}
      ${
        ctaUrl
          ? `<a href="${ctaUrl}" class="cta">${
              ctaLabel || 'View Details'
            }</a>`
          : ''
      }
    </div>

    <div class="footer">
      <p>
        Dr. Vijay's Interventional Radiology Clinic, Chennai, Tamil Nadu ·
        ${EMAIL_USER || 'clinic@drVijay.com'}
      </p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Notification Service
 *
 * Responsibilities:
 * - Store in-app notifications in Firestore
 * - Send email notifications via Nodemailer + Gmail SMTP
 */
export class NotificationService {
  /**
   * Create an in-app notification in Firestore.
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>
  ): Promise<Notification> {
    const id = uuid();

    const notification = {
      id,
      userId,
      type,
      title,
      body,
      isRead: false,
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection(collections.notifications)
      .doc(id)
      .set(notification);

    return notification as unknown as Notification;
  }

  /**
   * Get all notifications for a user.
   */
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const snap = await db
      .collection(collections.notifications)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as unknown as Notification[];
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    const ref = db.collection(collections.notifications).doc(id);

    if (!(await ref.get()).exists) {
      throw new NotFoundError('Notification');
    }

    await ref.update({ isRead: true });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<void> {
    const snap = await db
      .collection(collections.notifications)
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();

    const batch = db.batch();

    snap.docs.forEach((d) => {
      batch.update(d.ref, { isRead: true });
    });

    await batch.commit();
  }

  // ─── Email Senders ──────────────────────────────────────────────────────────

  /**
   * Send appointment confirmation email.
   */
  async sendAppointmentConfirmation(
    to: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    serviceName: string
  ): Promise<void> {
    const body = `
      <p>Dear ${patientName},</p>

      <p>Your appointment has been confirmed. Here are your details:</p>

      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280;width:140px">
            Service
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">
            ${serviceName}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280">
            Date
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">
            ${appointmentDate}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280">
            Time
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">
            ${appointmentTime}
          </td>
        </tr>
      </table>

      <p>
        Please arrive 10 minutes early. If you need to reschedule,
        contact us at least 24 hours in advance.
      </p>
    `;

    await this.sendEmail(
      to,
      '✅ Appointment Confirmed — Dr. Vijay Clinic',
      'Appointment Confirmed',
      body
    );
  }

  /**
   * Send appointment cancellation email.
   */
  async sendCancellationEmail(
    to: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    refundInfo?: string
  ): Promise<void> {
    const body = `
      <p>Dear ${patientName},</p>

      <p>
        Your appointment on <strong>${appointmentDate}</strong>
        at <strong>${appointmentTime}</strong> has been cancelled.
      </p>

      ${
        refundInfo
          ? `<p><strong>Refund:</strong> ${refundInfo}</p>`
          : ''
      }

      <p>To book a new appointment, visit our website.</p>
    `;

    await this.sendEmail(
      to,
      '❌ Appointment Cancelled — Dr. Vijay Clinic',
      'Appointment Cancelled',
      body
    );
  }

  /**
   * Send appointment reminder email.
   */
  async sendReminderEmail(
    to: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string,
    meetingUrl?: string
  ): Promise<void> {
    const body = `
      <p>Dear ${patientName},</p>

      <p>
        This is a reminder that your appointment is tomorrow,
        <strong>${appointmentDate}</strong> at
        <strong>${appointmentTime}</strong>.
      </p>

      ${
        meetingUrl
          ? `<p>
              Your video consultation link:
              <a href="${meetingUrl}">${meetingUrl}</a>
             </p>`
          : ''
      }

      <p>
        Please ensure you have all relevant medical documents ready.
      </p>
    `;

    await this.sendEmail(
      to,
      '⏰ Appointment Reminder — Dr. Vijay Clinic',
      'Your Appointment Is Tomorrow',
      body
    );
  }

  /**
   * Send payment confirmation email.
   */
  async sendPaymentConfirmationEmail(
    to: string,
    patientName: string,
    amountInPaise: number,
    transactionId: string
  ): Promise<void> {
    const amount = (amountInPaise / 100).toFixed(2);

    const body = `
      <p>Dear ${patientName},</p>

      <p>
        We have received your payment of
        <strong>₹${amount}</strong>.
      </p>

      <p>
        Transaction ID:
        <code>${transactionId}</code>
      </p>

      <p>
        Your appointment has been confirmed. Thank you!
      </p>
    `;

    await this.sendEmail(
      to,
      '💳 Payment Received — Dr. Vijay Clinic',
      'Payment Confirmed',
      body
    );
  }

  /**
   * Send prescription email.
   */
  async sendPrescriptionEmail(
    to: string,
    patientName: string,
    medicines: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>,
    notes?: string
  ): Promise<void> {
    const medicineRows = medicines
      .map(
        (m) =>
          `<tr>
            <td style="padding:10px;border:1px solid #e5e7eb">
              ${m.name}
            </td>

            <td style="padding:10px;border:1px solid #e5e7eb">
              ${m.dosage}
            </td>

            <td style="padding:10px;border:1px solid #e5e7eb">
              ${m.frequency}
            </td>

            <td style="padding:10px;border:1px solid #e5e7eb">
              ${m.duration}
            </td>
          </tr>`
      )
      .join('');

    const body = `
      <p>Dear ${patientName},</p>

      <p>Your prescription has been issued:</p>

      <table style="border-collapse:collapse;width:100%;margin:16px 0">

        <thead>
          <tr style="background:#f3f4f6">

            <th style="padding:10px;border:1px solid #e5e7eb;text-align:left">
              Medicine
            </th>

            <th style="padding:10px;border:1px solid #e5e7eb;text-align:left">
              Dosage
            </th>

            <th style="padding:10px;border:1px solid #e5e7eb;text-align:left">
              Frequency
            </th>

            <th style="padding:10px;border:1px solid #e5e7eb;text-align:left">
              Duration
            </th>

          </tr>
        </thead>

        <tbody>
          ${medicineRows}
        </tbody>

      </table>

      ${
        notes
          ? `<p><strong>Notes:</strong> ${notes}</p>`
          : ''
      }
    `;

    await this.sendEmail(
      to,
      '💊 Your Prescription — Dr. Vijay Clinic',
      'Prescription Issued',
      body
    );
  }

  /**
   * Core email sender using Nodemailer + Gmail SMTP.
   */
  private async sendEmail(
    to: string,
    subject: string,
    title: string,
    htmlBody: string,
    ctaUrl?: string,
    ctaLabel?: string
  ): Promise<void> {
    try {
      if (!transporter) {
        logger.warn(
          'Gmail email configuration is missing. Email was not sent.'
        );
        return;
      }

      const html = buildEmailHtml(
        title,
        htmlBody,
        ctaUrl,
        ctaLabel
      );

      await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      logger.error(`Failed to send email to ${to}`, err);

      // Email failures should not break the request.
    }
  }
}

export const notificationService = new NotificationService();