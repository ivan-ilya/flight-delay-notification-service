/**
 * Mock fetch function that simulates an external flight status API.
 * Used for development and demonstration purposes only.
 */

import type { FlightStatusCode } from "../models/types.js";

const AIRLINES: Record<string, string> = {
  AA: "American Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  SW: "Southwest Airlines",
};

const AIRPORTS = ["JFK", "LAX", "ORD", "ATL", "DFW", "SFO", "MIA", "SEA"];
const STATUSES: FlightStatusCode[] = ["scheduled", "boarding", "departed", "in_air", "landed"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createMockFetchFn(): (flightIds: string[]) => Promise<unknown[]> {
  return async (flightIds: string[]): Promise<unknown[]> => {
    return flightIds.map((flightId) => {
      const airlineCode = flightId.slice(0, 2);
      const airline = AIRLINES[airlineCode] ?? "Unknown Airlines";
      const origin = randomElement(AIRPORTS);
      let destination = randomElement(AIRPORTS);
      while (destination === origin) {
        destination = randomElement(AIRPORTS);
      }

      const hasDelay = Math.random() < 0.7;
      const delayMinutes = hasDelay ? Math.floor(Math.random() * 90) : 0;

      const now = new Date();
      const scheduledDeparture = new Date(now.getTime() + 60 * 60 * 1000);
      const estimatedDeparture = new Date(
        scheduledDeparture.getTime() + delayMinutes * 60 * 1000,
      );

      return {
        flightId,
        airline: `${airline} [MOCK]`,
        flightNumber: flightId,
        origin,
        destination,
        scheduledDeparture: scheduledDeparture.toISOString(),
        estimatedDeparture: estimatedDeparture.toISOString(),
        scheduledArrival: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        estimatedArrival: new Date(
          now.getTime() + 4 * 60 * 60 * 1000 + delayMinutes * 60 * 1000,
        ).toISOString(),
        status: randomElement(STATUSES),
        delayMinutes,
        lastUpdated: now.toISOString(),
      };
    });
  };
}
