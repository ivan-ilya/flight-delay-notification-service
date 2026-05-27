import { FlightStatus, IFlightStore } from "../models/types.js";

/**
 * In-memory flight status store.
 * Stores the latest FlightStatus per flightId using a Map.
 * The set() method returns the previous status to enable change detection.
 *
 * Requirements: 1.4, 2.1
 */
export class FlightStore implements IFlightStore {
  private store: Map<string, FlightStatus> = new Map();

  /**
   * Retrieve the current status for a flight.
   * Returns undefined if the flight is not tracked.
   */
  get(flightId: string): FlightStatus | undefined {
    return this.store.get(flightId);
  }

  /**
   * Store or update the status for a flight.
   * Returns the previous status (or undefined if new) so callers can compare
   * delay values for change detection.
   */
  set(flightId: string, status: FlightStatus): FlightStatus | undefined {
    const previous = this.store.get(flightId);
    this.store.set(flightId, status);
    return previous;
  }

  /**
   * Check whether a flight is currently tracked.
   */
  has(flightId: string): boolean {
    return this.store.has(flightId);
  }

  /**
   * Return a copy of all tracked flight statuses.
   */
  getAll(): Map<string, FlightStatus> {
    return new Map(this.store);
  }

  /**
   * Remove a flight from the store.
   * Returns true if the flight existed and was removed, false otherwise.
   */
  remove(flightId: string): boolean {
    return this.store.delete(flightId);
  }

  /**
   * Clear all tracked flights from the store.
   */
  clear(): void {
    this.store.clear();
  }
}
