/**
 * TUI Flights API adapter.
 * Fetches real flight data from the TUI MCP flights endpoint
 * and transforms it into the format expected by our notification service.
 *
 * This adapter calls the same API that the TUI Flights MCP server uses.
 */

import type { FlightStatusCode } from "../models/types.js";

// ─── TUI API Types ────────────────────────────────────────────────────────────

interface TuiFlight {
  flight_number: string;
  origin: string;
  destination: string;
  date: string;
  departure: string;
  arrival: string;
  status: string;
  delay_minutes: number;
  delay_reason?: string;
  aircraft?: string;
  gate?: string;
}

interface TuiDelaysResponse {
  delayed_flights: TuiFlight[];
  count: number;
}

interface TuiSearchResponse {
  flights: TuiFlight[];
  count: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface TuiAdapterConfig {
  apiUrl: string;
  apiKey: string;
}

const DEFAULT_CONFIG: TuiAdapterConfig = {
  apiUrl: process.env.TUI_API_URL ?? "https://dwzlz974ba.execute-api.eu-west-2.amazonaws.com/prod/flights",
  apiKey: process.env.TUI_API_KEY ?? "",
};

// ─── Status Mapping ───────────────────────────────────────────────────────────

function mapTuiStatus(tuiStatus: string): FlightStatusCode {
  const mapping: Record<string, FlightStatusCode> = {
    "on-time": "scheduled",
    "delayed": "scheduled",
    "boarding": "boarding",
    "departed": "departed",
    "in-flight": "in_air",
    "landed": "landed",
    "arrived": "arrived",
    "cancelled": "cancelled",
    "diverted": "diverted",
  };
  return mapping[tuiStatus] ?? "scheduled";
}

// ─── Transform TUI flight to our format ───────────────────────────────────────

function transformFlight(flight: TuiFlight): Record<string, unknown> {
  const now = new Date();
  const flightDate = flight.date;

  // Parse departure time
  const scheduledDeparture = new Date(`${flightDate}T${flight.departure}:00Z`);
  const estimatedDeparture = new Date(
    scheduledDeparture.getTime() + (flight.delay_minutes ?? 0) * 60 * 1000,
  );

  // Parse arrival time
  const scheduledArrival = new Date(`${flightDate}T${flight.arrival}:00Z`);
  const estimatedArrival = new Date(
    scheduledArrival.getTime() + (flight.delay_minutes ?? 0) * 60 * 1000,
  );

  return {
    flightId: flight.flight_number,
    airline: "TUI Airways",
    flightNumber: flight.flight_number,
    origin: flight.origin,
    destination: flight.destination,
    scheduledDeparture: scheduledDeparture.toISOString(),
    estimatedDeparture: estimatedDeparture.toISOString(),
    scheduledArrival: scheduledArrival.toISOString(),
    estimatedArrival: estimatedArrival.toISOString(),
    status: mapTuiStatus(flight.status),
    delayMinutes: flight.delay_minutes ?? 0,
    lastUpdated: now.toISOString(),
  };
}

// ─── MCP Tool Call via HTTP ───────────────────────────────────────────────────

async function callMcpTool(
  config: TuiAdapterConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`TUI API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

// ─── Exported Fetch Functions ─────────────────────────────────────────────────

/**
 * Creates a fetch function that gets delayed flights from TUI.
 * This is the primary fetch function for the notification service —
 * it only returns flights with delays, which is what we care about.
 */
export function createTuiFetchFn(
  config: TuiAdapterConfig = DEFAULT_CONFIG,
  minDelayMinutes: number = 0,
): (flightIds: string[]) => Promise<unknown[]> {
  return async (_flightIds: string[]): Promise<unknown[]> => {
    try {
      const result = await callMcpTool(config, "get_delays", {
        minimum_delay_minutes: minDelayMinutes,
      });

      // Parse the MCP response
      const content = (result as any)?.result?.content;
      if (!content || !Array.isArray(content)) {
        console.warn("[TuiAdapter] Unexpected MCP response format, trying direct parse");
        // Try to parse as direct response
        const directResult = result as any;
        if (directResult?.delayed_flights) {
          return (directResult.delayed_flights as TuiFlight[]).map(transformFlight);
        }
        return [];
      }

      // MCP returns content as text, parse it
      const textContent = content.find((c: any) => c.type === "text");
      if (!textContent?.text) {
        return [];
      }

      const parsed = JSON.parse(textContent.text) as TuiDelaysResponse;
      return (parsed.delayed_flights ?? []).map(transformFlight);
    } catch (error) {
      console.warn(
        "[TuiAdapter] Error fetching from TUI API:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  };
}

/**
 * Creates a fetch function that searches flights by route.
 * Useful for monitoring specific routes.
 */
export function createTuiRouteFetchFn(
  origin: string,
  destination: string,
  config: TuiAdapterConfig = DEFAULT_CONFIG,
): (flightIds: string[]) => Promise<unknown[]> {
  return async (_flightIds: string[]): Promise<unknown[]> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await callMcpTool(config, "search_flights", {
        origin,
        destination,
        date: today,
      });

      const content = (result as any)?.result?.content;
      if (!content || !Array.isArray(content)) {
        const directResult = result as any;
        if (directResult?.flights) {
          return (directResult.flights as TuiFlight[]).map(transformFlight);
        }
        return [];
      }

      const textContent = content.find((c: any) => c.type === "text");
      if (!textContent?.text) {
        return [];
      }

      const parsed = JSON.parse(textContent.text) as TuiSearchResponse;
      return (parsed.flights ?? []).map(transformFlight);
    } catch (error) {
      console.warn(
        "[TuiAdapter] Error fetching route from TUI API:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  };
}
