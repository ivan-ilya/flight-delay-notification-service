import type {
  DeliveryResult,
  INotificationChannel,
  Notification,
} from "../models/types.js";

/**
 * Console notification channel that logs formatted delay notifications to stdout.
 * Always available, always succeeds.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.4
 */
export class ConsoleChannel implements INotificationChannel {
  readonly id = "console";
  readonly name = "Console";

  /**
   * Format and log the notification as human-readable plain text.
   */
  async send(notification: Notification): Promise<DeliveryResult> {
    const metadata = notification.metadata as Record<string, unknown>;
    const severity = (metadata.severity as string) ?? "unknown";

    const output = [
      "════════════════════════════════════════",
      `  FLIGHT DELAY ALERT [${severity.toUpperCase()}]`,
      "════════════════════════════════════════",
      `  ${notification.subject}`,
      "────────────────────────────────────────",
      notification.body,
      "════════════════════════════════════════",
    ].join("\n");

    console.log(output);

    return {
      notificationId: notification.id,
      channel: this.id,
      success: true,
      deliveredAt: new Date(),
    };
  }

  /**
   * Console channel is always available.
   */
  isAvailable(): boolean {
    return true;
  }
}
