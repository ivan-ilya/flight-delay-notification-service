# Flight Delay Notification Service

An event-driven microservice that monitors flight status and sends notifications through multiple channels when delays exceed configurable thresholds. Built with TypeScript and Node.js.

## Features

- Polls flight status on a configurable schedule
- Evaluates delays against warning (15 min) and critical (60 min) thresholds
- Dispatches notifications concurrently to multiple channels
- Three notification channels:
  - **Console** — human-readable plain text to stdout
  - **Email (Mock)** — simulated email delivery logged to console
  - **Telegram (Real)** — sends messages to a Telegram channel via Bot API
- Cooldown enforcement to prevent notification spam
- Graceful error handling — one channel failing doesn't affect others
- Graceful shutdown via SIGTERM/SIGINT

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  FlightPoller   │────▶│ FlightStore  │────▶│   DelayEvaluator    │
│ (scheduled poll)│     │ (in-memory)  │     │ (threshold + cooldown)│
└─────────────────┘     └──────────────┘     └──────────┬────────────┘
                                                        │
                                              threshold breached
                                                        │
                                                        ▼
                                               ┌────────────────┐
                                               │    EventBus    │
                                               │ (EventEmitter) │
                                               └───────┬────────┘
                                                       │
                                                       ▼
                                          ┌────────────────────────┐
                                          │ NotificationDispatcher │
                                          └───┬────────┬────────┬──┘
                                              │        │        │
                                              ▼        ▼        ▼
                                          Console   Email    Telegram
                                                   (mock)    (real)
```

## Prerequisites

- Node.js 18+ (for native `fetch`)
- npm

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Available environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_TUI_API` | `false` | Set to `true` to use real TUI Flights API |
| `POLLING_INTERVAL_MS` | `30000` | How often to poll flight status (ms) |
| `WARNING_THRESHOLD_MINUTES` | `15` | Delay minutes to trigger a warning |
| `CRITICAL_THRESHOLD_MINUTES` | `60` | Delay minutes to trigger a critical alert |
| `COOLDOWN_MINUTES` | `10` | Min time between notifications for the same flight |
| `NOTIFY_ON_RESOLVE` | `true` | Notify when a delay resolves |
| `TRACKED_FLIGHTS` | `TOM1234,TOM1235,TOM2456` | Comma-separated TUI flight numbers to monitor |
| `TELEGRAM_BOT_TOKEN` | — | Telegram Bot API token (optional) |
| `TELEGRAM_CHAT_ID` | — | Telegram chat/channel ID (optional) |

### 3. Run the service

```bash
npm start
```

The service starts polling immediately. Without Telegram credentials, it uses Console and Email (mock) channels only.

### 4. Run with real TUI flight data

```bash
USE_TUI_API=true npm start
```

This connects to the TUI Flights MCP server and fetches real delayed flights from UK airports (Gatwick, Manchester, etc.).

### 5. Run with Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Create a channel and add your bot as an admin
3. Set the env vars:

```bash
export TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
export TELEGRAM_CHAT_ID=@yourchannel
export USE_TUI_API=true
npm start
```

## Running Tests

```bash
npm test
```

Tests use [Vitest](https://vitest.dev/) and include Zod schema validation tests.

## CI/CD

Two GitHub Actions workflows are included:

- **CI** (`.github/workflows/ci.yml`) — runs TypeScript check + tests on every push/PR
- **Check Flight Delays** (`.github/workflows/check-delays.yml`) — scheduled every 3 hours (5:00–20:00 UTC), polls TUI API and sends notifications to Telegram

### Switching between real and mock data in CI

In `.github/workflows/check-delays.yml`, change the `USE_TUI_API` value:

```yaml
# Real TUI data:
USE_TUI_API: 'true'

# Mock data:
USE_TUI_API: 'false'
```

Commit and push — the next scheduled run will use the new setting.

### Required GitHub Secrets

Add these in Settings → Secrets → Repository secrets:

| Secret | Value |
|--------|-------|
| `TUI_API_URL` | TUI flights API endpoint |
| `TUI_API_KEY` | TUI API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Channel ID (e.g. `@flight_delay_monitor`) |

## Project Structure

```
├── src/
│   ├── main.ts                    # Service entry point & bootstrap
│   ├── adapters/
│   │   └── tuiFlightsAdapter.ts   # Real TUI Flights API adapter
│   ├── config/
│   │   └── index.ts               # Centralized config from env vars
│   ├── mock/
│   │   └── mockFetchFn.ts         # Mock flight status API for development
│   ├── models/
│   │   ├── types.ts               # TypeScript interfaces & types
│   │   └── schemas.ts             # Zod validation schemas
│   ├── store/
│   │   └── FlightStore.ts         # In-memory flight status store
│   ├── evaluator/
│   │   └── DelayEvaluator.ts      # Threshold evaluation & cooldown
│   ├── events/
│   │   └── EventBus.ts            # Typed event bus (EventEmitter wrapper)
│   ├── poller/
│   │   └── FlightPoller.ts        # Scheduled flight status polling
│   ├── dispatcher/
│   │   └── NotificationDispatcher.ts  # Multi-channel notification dispatch
│   └── channels/
│       ├── ConsoleChannel.ts      # Console output channel
│       ├── EmailChannel.ts        # Mock email channel
│       └── TelegramChannel.ts     # Real Telegram Bot API channel
├── tests/
│   └── models/
│       └── schemas.test.ts        # Schema validation tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── .gitignore
```

## How It Works

1. **FlightPoller** fetches status for all tracked flights at the configured interval
   - With `USE_TUI_API=true`: calls the TUI Flights MCP server for real delayed flights from UK airports
   - With `USE_TUI_API=false` (default): uses mock data for development
2. **FlightStore** stores the latest status and returns the previous one for comparison
3. **DelayEvaluator** checks if the delay crosses a threshold (warning or critical) and respects cooldown periods
4. If a threshold is breached, a `delay.threshold_breached` event is emitted on the **EventBus**
5. **NotificationDispatcher** listens for that event and dispatches to all registered channels concurrently
6. Each **channel** formats and delivers the notification independently

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript | Type-safe implementation |
| Node.js 18+ | Runtime with native fetch |
| Zod | Runtime data validation |
| uuid | Unique ID generation |
| Vitest | Test framework |
| fast-check | Property-based testing |
| tsx | TypeScript execution without build step |

## License

MIT
