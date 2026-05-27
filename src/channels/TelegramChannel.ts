import type {
  DeliveryResult,
  INotificationChannel,
  Notification,
} from "../models/types.js";

/**
 * Configuration for the Telegram notification channel.
 */
export interface TelegramChannelConfig {
  botToken: string;
  chatId: string;
  apiBaseUrl?: string;
}

/**
 * Real Telegram notification channel that sends formatted messages
 * to a Telegram chat using the Telegram Bot API.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3
 */
export class TelegramChannel implements INotificationChannel {
  readonly id = "telegram";
  readonly name = "Telegram";

  private readonly botToken: string;
  private readonly chatId: string;
  private readonly apiBaseUrl: string;

  constructor(config: TelegramChannelConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.apiBaseUrl = config.apiBaseUrl ?? "https://api.telegram.org";
  }

  /**
   * Format and send the notification to Telegram via the Bot API.
   */
  async send(notification: Notification): Promise<DeliveryResult> {
    const message = this.formatMessage(notification);
    const url = `${this.apiBaseUrl}/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      if (response.ok) {
        const body = (await response.json()) as { ok: boolean };
        if (body.ok) {
          return {
            notificationId: notification.id,
            channel: this.id,
            success: true,
            deliveredAt: new Date(),
          };
        }
      }

      // Handle error responses
      const statusCode = response.status;
      const errorBody = await response.text();
      const retryable = this.isRetryableStatus(statusCode);

      return {
        notificationId: notification.id,
        channel: this.id,
        success: false,
        error: `Telegram API error (${statusCode}): ${errorBody}`,
        retryable,
      };
    } catch (error: unknown) {
      // Network errors are transient and retryable
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        notificationId: notification.id,
        channel: this.id,
        success: false,
        error: `Network error: ${errorMessage}`,
        retryable: true,
      };
    }
  }

  /**
   * Telegram channel is available only when both botToken and chatId are configured.
   */
  isAvailable(): boolean {
    return this.botToken.length > 0 && this.chatId.length > 0;
  }

  /**
   * Format the notification as an HTML message for Telegram with emoji indicators.
   */
  private formatMessage(notification: Notification): string {
    const metadata = notification.metadata as Record<string, unknown>;
    const severity = (metadata.severity as string) ?? "unknown";
    const delayMinutes = (metadata.delayMinutes as number) ?? 0;
    const emoji = severity === "critical" ? "🚨" : "⚠️";

    const lines = [
      `${emoji} <b>Flight Delay Alert</b>`,
      "",
      `<b>${notification.subject}</b>`,
      "",
      notification.body
        .split("\n")
        .map((line) => this.escapeHtml(line))
        .join("\n"),
    ];

    return lines.join("\n");
  }

  /**
   * Escape HTML special characters for Telegram HTML parse mode.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Determine if an HTTP status code represents a transient (retryable) error.
   * - 429 (rate limit), 5xx (server errors) are retryable
   * - 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found) are permanent
   */
  private isRetryableStatus(statusCode: number): boolean {
    if (statusCode === 429) return true;
    if (statusCode >= 500) return true;
    return false;
  }
}
