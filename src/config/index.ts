/**
 * Application configuration loaded from environment variables.
 * Centralizes all config parsing and provides sensible defaults.
 */

export interface AppConfig {
  pollingIntervalMs: number;
  warningThresholdMinutes: number;
  criticalThresholdMinutes: number;
  cooldownMinutes: number;
  notifyOnResolve: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  trackedFlights: string[];
}

export function loadConfig(): AppConfig {
  return {
    pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS ?? "30000", 10),
    warningThresholdMinutes: parseInt(process.env.WARNING_THRESHOLD_MINUTES ?? "15", 10),
    criticalThresholdMinutes: parseInt(process.env.CRITICAL_THRESHOLD_MINUTES ?? "60", 10),
    cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES ?? "10", 10),
    notifyOnResolve: (process.env.NOTIFY_ON_RESOLVE ?? "true") === "true",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: process.env.TELEGRAM_CHAT_ID || undefined,
    trackedFlights: (process.env.TRACKED_FLIGHTS ?? "AA1234,UA5678")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  };
}
