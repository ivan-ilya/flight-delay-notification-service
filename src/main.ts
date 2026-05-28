/**
 * Main service entry point for the Flight Delay Notification System.
 * Wires all components together and starts the polling loop.
 */

import "dotenv/config";
import { loadConfig } from "./config/index.js";
import { createMockFetchFn } from "./mock/mockFetchFn.js";
import { createTuiFetchFn } from "./adapters/tuiFlightsAdapter.js";
import { FlightStore } from "./store/FlightStore.js";
import { DelayEvaluator } from "./evaluator/DelayEvaluator.js";
import { EventBus } from "./events/EventBus.js";
import { FlightPoller } from "./poller/FlightPoller.js";
import { NotificationDispatcher } from "./dispatcher/NotificationDispatcher.js";
import { ConsoleChannel } from "./channels/ConsoleChannel.js";
import { EmailChannel } from "./channels/EmailChannel.js";
import { TelegramChannel } from "./channels/TelegramChannel.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const config = loadConfig();

// ─── Global Error Handling ────────────────────────────────────────────────────

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[UnhandledRejection]", reason instanceof Error ? reason.message : reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[UncaughtException] Critical error:", error.message);
  process.exit(1);
});

// ─── Component Instantiation ──────────────────────────────────────────────────

const store = new FlightStore();

const evaluator = new DelayEvaluator({
  warningMinutes: config.warningThresholdMinutes,
  criticalMinutes: config.criticalThresholdMinutes,
  cooldownMinutes: config.cooldownMinutes,
  notifyOnResolve: config.notifyOnResolve,
});

const eventBus = new EventBus();

// Choose fetch function: TUI real API or mock
const useTuiApi = process.env.USE_TUI_API === "true";
const fetchFn = useTuiApi
  ? createTuiFetchFn()
  : createMockFetchFn();

const poller = new FlightPoller({
  intervalMs: config.pollingIntervalMs,
  flightIds: config.trackedFlights,
  fetchFn,
  store,
  evaluator,
  eventBus,
});

const dispatcher = new NotificationDispatcher(eventBus);

// ─── Register Notification Channels ──────────────────────────────────────────

dispatcher.registerChannel(new ConsoleChannel());
dispatcher.registerChannel(new EmailChannel());

if (config.telegramBotToken && config.telegramChatId) {
  dispatcher.registerChannel(
    new TelegramChannel({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
    }),
  );
  console.log("[Main] Telegram channel registered");
} else {
  console.log("[Main] Telegram channel skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set)");
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`[Main] Received ${signal}, shutting down gracefully...`);
  poller.stop();
  eventBus.removeAllListeners();
  console.log("[Main] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Start Service ───────────────────────────────────────────────────────────

console.log("[Main] Flight Delay Notification Service starting...");
console.log("[Main] Configuration:");
console.log(`  Data source: ${useTuiApi ? "TUI Flights API (real)" : "Mock data"}`);
console.log(`  Polling interval: ${config.pollingIntervalMs}ms`);
console.log(`  Warning threshold: ${config.warningThresholdMinutes} minutes`);
console.log(`  Critical threshold: ${config.criticalThresholdMinutes} minutes`);
console.log(`  Cooldown: ${config.cooldownMinutes} minutes`);
console.log(`  Notify on resolve: ${config.notifyOnResolve}`);
console.log(`  Tracked flights: ${config.trackedFlights.join(", ")}`);
console.log(`  Channels: ${dispatcher.getChannels().map((ch) => ch.name).join(", ")}`);

poller.start();
console.log("[Main] Polling started");
