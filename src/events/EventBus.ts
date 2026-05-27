import { EventEmitter } from "node:events";
import type { EventMap, IEventBus } from "../models/types.js";

/**
 * Typed EventBus wrapping Node.js EventEmitter.
 * Provides type-safe event registration and emission with async handler support.
 * Individual handler failures are isolated — one failing handler does not prevent others from executing.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
export class EventBus implements IEventBus {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Register a handler for a typed event.
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Unregister a handler for a typed event.
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void | Promise<void>,
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Emit a typed event and await all handlers.
   * Individual handler failures are caught and logged — remaining handlers continue executing.
   */
  async emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K],
  ): Promise<void> {
    const handlers = this.emitter.listeners(event) as Array<
      (payload: EventMap[K]) => void | Promise<void>
    >;

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(payload)),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `[EventBus] Handler error on "${String(event)}":`,
          result.reason,
        );
      }
    }
  }

  /**
   * Remove all listeners from all events.
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
