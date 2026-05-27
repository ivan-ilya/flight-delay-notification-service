import { describe, it, expect } from "vitest";
import {
  parseFlightStatus,
  safeParseFlightStatus,
  parseThresholdConfig,
  safeParseThresholdConfig,
} from "../../src/models/schemas.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validFlightStatusData() {
  return {
    flightId: "FL123",
    airline: "TestAir",
    flightNumber: "TA456",
    origin: "JFK",
    destination: "LAX",
    scheduledDeparture: "2024-06-15T10:00:00Z",
    estimatedDeparture: "2024-06-15T10:30:00Z",
    scheduledArrival: "2024-06-15T14:00:00Z",
    estimatedArrival: "2024-06-15T14:30:00Z",
    status: "scheduled" as const,
    delayMinutes: 30,
    lastUpdated: "2024-06-15T09:00:00Z",
  };
}

function validThresholdConfigData() {
  return {
    warningMinutes: 15,
    criticalMinutes: 60,
    notifyOnResolve: true,
    cooldownMinutes: 10,
  };
}

// ─── FlightStatus Schema Tests ────────────────────────────────────────────────

describe("FlightStatusSchema", () => {
  it("parses valid flight status data with ISO date strings", () => {
    const data = validFlightStatusData();
    const result = parseFlightStatus(data);

    expect(result.flightId).toBe("FL123");
    expect(result.airline).toBe("TestAir");
    expect(result.delayMinutes).toBe(30);
    expect(result.scheduledDeparture).toBeInstanceOf(Date);
    expect(result.estimatedDeparture).toBeInstanceOf(Date);
    expect(result.status).toBe("scheduled");
  });

  it("accepts delayMinutes of 0", () => {
    const data = { ...validFlightStatusData(), delayMinutes: 0 };
    const result = parseFlightStatus(data);
    expect(result.delayMinutes).toBe(0);
  });

  it("accepts optional actualDeparture and actualArrival", () => {
    const data = {
      ...validFlightStatusData(),
      actualDeparture: "2024-06-15T10:35:00Z",
      actualArrival: "2024-06-15T14:35:00Z",
    };
    const result = parseFlightStatus(data);
    expect(result.actualDeparture).toBeInstanceOf(Date);
    expect(result.actualArrival).toBeInstanceOf(Date);
  });

  it("rejects empty flightId", () => {
    const data = { ...validFlightStatusData(), flightId: "" };
    const result = safeParseFlightStatus(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative delayMinutes", () => {
    const data = { ...validFlightStatusData(), delayMinutes: -5 };
    const result = safeParseFlightStatus(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const data = { flightId: "FL123" };
    const result = safeParseFlightStatus(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid status code", () => {
    const data = { ...validFlightStatusData(), status: "unknown" };
    const result = safeParseFlightStatus(data);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer delayMinutes", () => {
    const data = { ...validFlightStatusData(), delayMinutes: 10.5 };
    const result = safeParseFlightStatus(data);
    expect(result.success).toBe(false);
  });

  it("throws ZodError for invalid data via parseFlightStatus", () => {
    const data = { ...validFlightStatusData(), flightId: "" };
    expect(() => parseFlightStatus(data)).toThrow();
  });
});

// ─── ThresholdConfig Schema Tests ─────────────────────────────────────────────

describe("ThresholdConfigSchema", () => {
  it("parses valid threshold config", () => {
    const data = validThresholdConfigData();
    const result = parseThresholdConfig(data);

    expect(result.warningMinutes).toBe(15);
    expect(result.criticalMinutes).toBe(60);
    expect(result.notifyOnResolve).toBe(true);
    expect(result.cooldownMinutes).toBe(10);
  });

  it("accepts cooldownMinutes of 0", () => {
    const data = { ...validThresholdConfigData(), cooldownMinutes: 0 };
    const result = parseThresholdConfig(data);
    expect(result.cooldownMinutes).toBe(0);
  });

  it("rejects criticalMinutes <= warningMinutes", () => {
    const data = { ...validThresholdConfigData(), criticalMinutes: 15, warningMinutes: 15 };
    const result = safeParseThresholdConfig(data);
    expect(result.success).toBe(false);
  });

  it("rejects criticalMinutes < warningMinutes", () => {
    const data = { ...validThresholdConfigData(), criticalMinutes: 10, warningMinutes: 15 };
    const result = safeParseThresholdConfig(data);
    expect(result.success).toBe(false);
  });

  it("rejects warningMinutes of 0", () => {
    const data = { ...validThresholdConfigData(), warningMinutes: 0 };
    const result = safeParseThresholdConfig(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative warningMinutes", () => {
    const data = { ...validThresholdConfigData(), warningMinutes: -5 };
    const result = safeParseThresholdConfig(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative cooldownMinutes", () => {
    const data = { ...validThresholdConfigData(), cooldownMinutes: -1 };
    const result = safeParseThresholdConfig(data);
    expect(result.success).toBe(false);
  });

  it("throws ZodError for invalid config via parseThresholdConfig", () => {
    const data = { ...validThresholdConfigData(), warningMinutes: 0 };
    expect(() => parseThresholdConfig(data)).toThrow();
  });
});
