import { v4 as uuidv4 } from "uuid";
import type {
  DelayNotificationEvent,
  DeliveryResult,
  IEventBus,
  INotificationChannel,
  INotificationDispatcher,
  Notification,
} from "../models/types.js";

/**
 * Dispatches notifications to all registered channels when a delay threshold is breached.
 * Listens for "delay.threshold_breached" events and sends notifications concurrently.
 * Channel failures are isolated — one channel failing does not affect others.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.2
 */
export class NotificationDispatcher implements INotificationDispatcher {
  private readonly channels: Map<string, INotificationChannel> = new Map();
  private readonly eventBus: IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
    this.eventBus.on(
      "delay.threshold_breached",
      this.handleThresholdBreached.bind(this),
    );
  }

  /**
   * Register a notification channel for dispatching.
   */
  registerChannel(channel: INotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  /**
   * Remove a notification channel by its ID.
   */
  removeChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  /**
   * Get all currently registered channels.
   */
  getChannels(): INotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Handle a threshold breached event by dispatching notifications to all channels.
   */
  private async handleThresholdBreached(
    event: DelayNotificationEvent,
  ): Promise<void> {
    const availableChannels = this.getChannels().filter((ch) =>
      ch.isAvailable(),
    );

    if (availableChannels.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      availableChannels.map(async (channel) => {
        const notification = this.createNotification(event, channel.id);
        return channel.send(notification);
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const deliveryResult = result.value;
        if (deliveryResult.success) {
          await this.eventBus.emit("notification.sent", deliveryResult);
        } else {
          await this.eventBus.emit("notification.failed", deliveryResult);
        }
      } else {
        // Channel threw an exception — emit a failed delivery result
        const failedResult: DeliveryResult = {
          notificationId: "unknown",
          channel: "unknown",
          success: false,
          error: result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
          retryable: true,
        };
        await this.eventBus.emit("notification.failed", failedResult);
      }
    }
  }

  /**
   * Create a Notification object from a DelayNotificationEvent for a specific channel.
   */
  private createNotification(
    event: DelayNotificationEvent,
    channelId: string,
  ): Notification {
    const flight = event.flightStatus;
    const subject = `Flight ${flight.flightNumber} - ${event.severity.toUpperCase()} Delay Alert`;
    const body = [
      `Flight: ${flight.flightNumber}`,
      `Route: ${flight.origin} → ${flight.destination}`,
      `Delay: ${event.delayMinutes} minutes`,
      `Severity: ${event.severity}`,
      `Scheduled Departure: ${flight.scheduledDeparture.toISOString()}`,
      `Estimated Departure: ${flight.estimatedDeparture.toISOString()}`,
    ].join("\n");

    return {
      id: uuidv4(),
      eventId: event.id,
      channel: channelId,
      recipient: "",
      subject,
      body,
      metadata: {
        flightId: event.flightId,
        severity: event.severity,
        delayMinutes: event.delayMinutes,
      },
      createdAt: new Date(),
    };
  }
}
