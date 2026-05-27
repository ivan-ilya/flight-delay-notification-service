import { v4 as uuidv4 } from "uuid";
import type {
  FlightStatus,
  DelayNotificationEvent,
  ThresholdConfig,
  IDelayEvaluator,
} from "../models/types.js";

/**
 * Evaluates flight status changes against configurable delay thresholds
 * and enforces cooldown periods to prevent notification spam.
 *
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7,
 *              4.1, 4.2, 4.3, 4.4, 4.5
 */
export class DelayEvaluator implements IDelayEvaluator {
  private config: ThresholdConfig;
  private lastNotificationTime: Map<string, number> = new Map();

  constructor(config: ThresholdConfig) {
    this.config = { ...config };
  }

  /**
   * Evaluate a flight status change and determine if a notification should be emitted.
   *
   * Algorithm:
   * 1. If delay hasn't changed (same delayMinutes as previous), return null (idempotent)
   * 2. Determine changeType: "new", "updated", or "resolved"
   * 3. If changeType is "resolved" and notifyOnResolve is true → emit warning notification
   * 4. Check cooldown: if last notification for this flight was within cooldownMinutes → return null
   * 5. If delay >= criticalMinutes → emit critical notification
   * 6. If delay >= warningMinutes → emit warning notification
   * 7. Otherwise → return null
   */
  evaluate(current: FlightStatus, previous?: FlightStatus): DelayNotificationEvent | null {
    const changeType = this.determineChangeType(current, previous);

    // Idempotent: if delay hasn't changed, no notification
    if (changeType === null) {
      return null;
    }

    const previousDelayMinutes = previous?.delayMinutes ?? 0;

    // Handle resolved case first
    if (changeType === "resolved") {
      if (!this.config.notifyOnResolve) {
        return null;
      }

      // Check cooldown even for resolved notifications
      if (this.isWithinCooldown(current.flightId)) {
        return null;
      }

      this.recordNotification(current.flightId);
      return this.createEvent(current, "warning", previousDelayMinutes, changeType);
    }

    // Check cooldown before emitting threshold-based notifications
    if (this.isWithinCooldown(current.flightId)) {
      return null;
    }

    // Determine severity based on thresholds
    const severity = this.determineSeverity(current.delayMinutes);
    if (severity === null) {
      return null;
    }

    this.recordNotification(current.flightId);
    return this.createEvent(current, severity, previousDelayMinutes, changeType);
  }

  /**
   * Update threshold configuration at runtime.
   * Requirements: 3.5
   */
  updateConfig(config: Partial<ThresholdConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Determine the type of change between current and previous status.
   * Returns null if no meaningful change occurred (idempotent).
   */
  private determineChangeType(
    current: FlightStatus,
    previous?: FlightStatus
  ): "new" | "updated" | "resolved" | null {
    // No previous status → new flight
    if (previous === undefined) {
      return "new";
    }

    // Same delay → no change (idempotent)
    if (current.delayMinutes === previous.delayMinutes) {
      return null;
    }

    // Was above warning threshold, now below → resolved
    if (
      previous.delayMinutes >= this.config.warningMinutes &&
      current.delayMinutes < this.config.warningMinutes
    ) {
      return "resolved";
    }

    // Delay changed → updated
    return "updated";
  }

  /**
   * Determine severity based on delay minutes and configured thresholds.
   */
  private determineSeverity(delayMinutes: number): "warning" | "critical" | null {
    if (delayMinutes >= this.config.criticalMinutes) {
      return "critical";
    }
    if (delayMinutes >= this.config.warningMinutes) {
      return "warning";
    }
    return null;
  }

  /**
   * Check if a flight is within its cooldown window.
   */
  private isWithinCooldown(flightId: string): boolean {
    const lastTime = this.lastNotificationTime.get(flightId);
    if (lastTime === undefined) {
      return false;
    }
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    return Date.now() - lastTime < cooldownMs;
  }

  /**
   * Record the current time as the last notification time for a flight.
   */
  private recordNotification(flightId: string): void {
    this.lastNotificationTime.set(flightId, Date.now());
  }

  /**
   * Create a DelayNotificationEvent with all required fields.
   */
  private createEvent(
    flightStatus: FlightStatus,
    severity: "warning" | "critical",
    previousDelayMinutes: number,
    changeType: "new" | "updated" | "resolved"
  ): DelayNotificationEvent {
    return {
      id: uuidv4(),
      flightId: flightStatus.flightId,
      flightStatus,
      severity,
      delayMinutes: flightStatus.delayMinutes,
      previousDelayMinutes,
      thresholdBreached:
        severity === "critical"
          ? this.config.criticalMinutes
          : this.config.warningMinutes,
      timestamp: new Date(),
    };
  }
}
