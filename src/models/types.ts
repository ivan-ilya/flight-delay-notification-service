/**
 * Core data model interfaces for the Flight Delay Notification System.
 * Requirements: 3.1, 10.1, 11.1
 */

// ─── Enums & Literal Types ────────────────────────────────────────────────────

/**
 * Possible flight status codes representing the current state of a flight.
 */
export type FlightStatusCode =
  | "scheduled"
  | "boarding"
  | "departed"
  | "in_air"
  | "landed"
  | "arrived"
  | "cancelled"
  | "diverted";

// ─── Core Data Models ─────────────────────────────────────────────────────────

/**
 * Represents the current status of a tracked flight.
 */
export interface FlightStatus {
  flightId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDeparture: Date;
  estimatedDeparture: Date;
  actualDeparture?: Date;
  scheduledArrival: Date;
  estimatedArrival: Date;
  actualArrival?: Date;
  status: FlightStatusCode;
  delayMinutes: number;
  lastUpdated: Date;
}

/**
 * Represents a detected change in flight status.
 */
export interface StatusChange {
  flightId: string;
  previousStatus: FlightStatus | null;
  currentStatus: FlightStatus;
  changeType: "new" | "updated" | "resolved";
  delayDelta: number;
  timestamp: Date;
}

/**
 * Event emitted when a delay threshold is breached.
 */
export interface DelayNotificationEvent {
  id: string;
  flightId: string;
  flightStatus: FlightStatus;
  severity: "warning" | "critical";
  delayMinutes: number;
  previousDelayMinutes: number;
  thresholdBreached: number;
  timestamp: Date;
  passengers?: string[];
}

/**
 * Result of attempting to deliver a notification through a channel.
 */
export interface DeliveryResult {
  notificationId: string;
  channel: string;
  success: boolean;
  deliveredAt?: Date;
  error?: string;
  retryable?: boolean;
}

/**
 * A notification to be dispatched to a channel.
 */
export interface Notification {
  id: string;
  eventId: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Configuration for delay threshold evaluation.
 */
export interface ThresholdConfig {
  warningMinutes: number;
  criticalMinutes: number;
  notifyOnResolve: boolean;
  cooldownMinutes: number;
}

/**
 * Default threshold configuration values.
 */
export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  warningMinutes: 15,
  criticalMinutes: 60,
  notifyOnResolve: true,
  cooldownMinutes: 10,
};

/**
 * Configuration for the flight status poller.
 */
export interface PollerConfig {
  intervalMs: number;
  flightIds: string[];
  fetchFn: (flightId: string) => Promise<FlightStatus>;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

/**
 * Result of evaluating a flight status change against thresholds.
 */
export interface EvaluationResult {
  shouldNotify: boolean;
  severity?: "warning" | "critical";
  thresholdBreached?: number;
  reason: string;
}

// ─── Interfaces (Contracts) ───────────────────────────────────────────────────

/**
 * Interface for notification delivery channels.
 */
export interface INotificationChannel {
  readonly id: string;
  readonly name: string;
  send(notification: Notification): Promise<DeliveryResult>;
  isAvailable(): boolean;
}

/**
 * Interface for the in-memory flight status store.
 */
export interface IFlightStore {
  get(flightId: string): FlightStatus | undefined;
  set(flightId: string, status: FlightStatus): FlightStatus | undefined;
  has(flightId: string): boolean;
  getAll(): Map<string, FlightStatus>;
  remove(flightId: string): boolean;
  clear(): void;
}

/**
 * Interface for the delay threshold evaluator.
 */
export interface IDelayEvaluator {
  evaluate(current: FlightStatus, previous?: FlightStatus): DelayNotificationEvent | null;
  updateConfig(config: Partial<ThresholdConfig>): void;
}

/**
 * Event map for the typed event bus.
 */
export interface EventMap {
  "delay.threshold_breached": DelayNotificationEvent;
  "notification.sent": DeliveryResult;
  "notification.failed": DeliveryResult;
}

/**
 * Interface for the typed event bus.
 */
export interface IEventBus {
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void | Promise<void>): void;
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void | Promise<void>): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void>;
  removeAllListeners(): void;
}

/**
 * Interface for the flight status poller.
 */
export interface IFlightPoller {
  start(): void;
  stop(): void;
  addFlight(flightId: string): void;
  removeFlight(flightId: string): void;
  isRunning(): boolean;
}

/**
 * Interface for the notification dispatcher.
 */
export interface INotificationDispatcher {
  registerChannel(channel: INotificationChannel): void;
  removeChannel(channelId: string): void;
  getChannels(): INotificationChannel[];
}

// ─── Stretch Goal ─────────────────────────────────────────────────────────────

/**
 * Passenger notification preferences (stretch goal).
 */
export interface PassengerPreference {
  passengerId: string;
  flightId: string;
  channels: string[];
  email?: string;
  phone?: string;
  pushToken?: string;
  minSeverity: "warning" | "critical";
}
