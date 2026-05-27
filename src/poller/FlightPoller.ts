import type {
  IFlightPoller,
  IFlightStore,
  IDelayEvaluator,
  IEventBus,
} from "../models/types.js";
import { safeParseFlightStatus } from "../models/schemas.js";

/**
 * Configuration for the FlightPoller.
 */
export interface FlightPollerConfig {
  intervalMs: number;
  flightIds: string[];
  fetchFn: (flightIds: string[]) => Promise<unknown[]>;
  store: IFlightStore;
  evaluator: IDelayEvaluator;
  eventBus: IEventBus;
}

/**
 * Polls flight status data at a configurable interval, validates responses,
 * stores statuses, evaluates delay thresholds, and emits notification events.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 11.2, 12.1
 */
export class FlightPoller implements IFlightPoller {
  private readonly intervalMs: number;
  private readonly flightIds: Set<string>;
  private readonly fetchFn: (flightIds: string[]) => Promise<unknown[]>;
  private readonly store: IFlightStore;
  private readonly evaluator: IDelayEvaluator;
  private readonly eventBus: IEventBus;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: FlightPollerConfig) {
    this.intervalMs = config.intervalMs;
    this.flightIds = new Set(config.flightIds);
    this.fetchFn = config.fetchFn;
    this.store = config.store;
    this.evaluator = config.evaluator;
    this.eventBus = config.eventBus;
  }

  /**
   * Start polling at the configured interval.
   * If already running, this is a no-op.
   */
  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
  }

  /**
   * Stop polling and clear the interval timer.
   * If not running, this is a no-op.
   */
  stop(): void {
    if (this.timer === null) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Add a flight ID to the tracked set.
   */
  addFlight(flightId: string): void {
    this.flightIds.add(flightId);
  }

  /**
   * Remove a flight ID from the tracked set.
   */
  removeFlight(flightId: string): void {
    this.flightIds.delete(flightId);
  }

  /**
   * Returns whether the poller is currently running.
   */
  isRunning(): boolean {
    return this.timer !== null;
  }

  /**
   * Execute a single polling cycle:
   * 1. Fetch statuses for all tracked flights
   * 2. Validate each entry with Zod schema
   * 3. Store valid entries and evaluate thresholds
   * 4. Emit events for threshold breaches
   */
  private async poll(): Promise<void> {
    const ids = Array.from(this.flightIds);
    if (ids.length === 0) {
      return;
    }

    let rawResults: unknown[];
    try {
      rawResults = await this.fetchFn(ids);
    } catch (error) {
      console.warn(
        "[FlightPoller] Fetch error, will retry next cycle:",
        error instanceof Error ? error.message : error,
      );
      return;
    }

    for (const raw of rawResults) {
      const result = safeParseFlightStatus(raw);

      if (!result.success) {
        console.warn(
          "[FlightPoller] Invalid flight status entry skipped:",
          result.error.issues,
        );
        continue;
      }

      const current = result.data;
      const previous = this.store.set(current.flightId, current);
      const event = this.evaluator.evaluate(current, previous ?? undefined);

      if (event !== null) {
        await this.eventBus.emit("delay.threshold_breached", event);
      }
    }
  }
}
