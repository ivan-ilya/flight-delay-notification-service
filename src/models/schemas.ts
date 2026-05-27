/**
 * Zod validation schemas for external data.
 * Validates flight status data from the external API and threshold configuration.
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { z } from "zod";
import type { FlightStatus, ThresholdConfig } from "./types.js";

// ─── Flight Status Code ───────────────────────────────────────────────────────

const FlightStatusCodeSchema = z.enum([
  "scheduled",
  "boarding",
  "departed",
  "in_air",
  "landed",
  "arrived",
  "cancelled",
  "diverted",
]);

// ─── Flight Status Schema ─────────────────────────────────────────────────────

/**
 * Validates flight status data coming from an external API.
 * Dates are parsed from ISO strings since the API returns JSON.
 * Requirement 11.1: Flight status data from the external API is validated against a schema.
 * Requirement 11.4: Flight IDs must be non-empty strings.
 * Requirement 11.5: Delay minutes must be >= 0.
 */
export const FlightStatusSchema = z.object({
  flightId: z.string().min(1, "flightId must be a non-empty string"),
  airline: z.string().min(1, "airline must be a non-empty string"),
  flightNumber: z.string().min(1, "flightNumber must be a non-empty string"),
  origin: z.string().min(1, "origin must be a non-empty string"),
  destination: z.string().min(1, "destination must be a non-empty string"),
  scheduledDeparture: z.coerce.date(),
  estimatedDeparture: z.coerce.date(),
  actualDeparture: z.coerce.date().optional(),
  scheduledArrival: z.coerce.date(),
  estimatedArrival: z.coerce.date(),
  actualArrival: z.coerce.date().optional(),
  status: FlightStatusCodeSchema,
  delayMinutes: z.number().int().min(0, "delayMinutes must be >= 0"),
  lastUpdated: z.coerce.date(),
});

// ─── Threshold Config Schema ──────────────────────────────────────────────────

/**
 * Validates threshold configuration.
 * Requirement 11.3: warningMinutes > 0, criticalMinutes > warningMinutes, cooldownMinutes >= 0.
 */
export const ThresholdConfigSchema = z
  .object({
    warningMinutes: z.number().int().positive("warningMinutes must be > 0"),
    criticalMinutes: z.number().int().positive("criticalMinutes must be > 0"),
    notifyOnResolve: z.boolean(),
    cooldownMinutes: z.number().int().min(0, "cooldownMinutes must be >= 0"),
  })
  .refine((data) => data.criticalMinutes > data.warningMinutes, {
    message: "criticalMinutes must be greater than warningMinutes",
    path: ["criticalMinutes"],
  });

// ─── Parse Functions ──────────────────────────────────────────────────────────

/**
 * Parses and validates external flight status data.
 * Returns a validated FlightStatus object with Date instances.
 * Throws ZodError if validation fails.
 */
export function parseFlightStatus(data: unknown): FlightStatus {
  return FlightStatusSchema.parse(data);
}

/**
 * Safely parses external flight status data without throwing.
 * Returns a discriminated result: { success: true, data } or { success: false, error }.
 */
export function safeParseFlightStatus(data: unknown): z.SafeParseReturnType<unknown, FlightStatus> {
  return FlightStatusSchema.safeParse(data);
}

/**
 * Parses and validates threshold configuration.
 * Returns a validated ThresholdConfig object.
 * Throws ZodError if validation fails.
 */
export function parseThresholdConfig(data: unknown): ThresholdConfig {
  return ThresholdConfigSchema.parse(data);
}

/**
 * Safely parses threshold configuration without throwing.
 * Returns a discriminated result: { success: true, data } or { success: false, error }.
 */
export function safeParseThresholdConfig(data: unknown): z.SafeParseReturnType<unknown, ThresholdConfig> {
  return ThresholdConfigSchema.safeParse(data);
}
