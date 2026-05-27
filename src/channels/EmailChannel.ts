import type {
  DeliveryResult,
  INotificationChannel,
  Notification,
} from "../models/types.js";

/**
 * Mock email notification channel that simulates email delivery by logging
 * the email content to console. Does NOT use SMTP, nodemailer, or any real transport.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 10.1, 10.5
 */
export class EmailChannel implements INotificationChannel {
  readonly id = "email";
  readonly name = "Email (Mock)";

  private readonly defaultRecipient: string;

  constructor(defaultRecipient: string = "passenger@example.com") {
    this.defaultRecipient = defaultRecipient;
  }

  /**
   * Format and log the notification as a mock email structure.
   */
  async send(notification: Notification): Promise<DeliveryResult> {
    const to = notification.recipient || this.defaultRecipient;
    const subject = notification.subject;
    const body = notification.body;

    const emailOutput = [
      "[MOCK EMAIL] ─────────────────────────────────",
      `  To:      ${to}`,
      `  Subject: ${subject}`,
      "  ─────────────────────────────────────────────",
      `  ${body.split("\n").join("\n  ")}`,
      "[MOCK EMAIL] ─────────────────────────────────",
    ].join("\n");

    console.log(emailOutput);

    return {
      notificationId: notification.id,
      channel: this.id,
      success: true,
      deliveredAt: new Date(),
    };
  }

  /**
   * Email mock channel is always available.
   */
  isAvailable(): boolean {
    return true;
  }
}
