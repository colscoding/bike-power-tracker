# Bike Power Tracker - Client

Progressive Web App for tracking cycling workouts with Bluetooth sensors, real-time streaming, and data export.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [User Guide](#user-guide)
- [Bluetooth Sensors](#bluetooth-sensors)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Configuration](#configuration)
- [Building](#building)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The BPT Client is a Progressive Web App (PWA) that connects to Bluetooth cycling sensors to track your workouts in real-time. It can work standalone or connect to the BPT Service for live streaming and workout history.

### Live App

🚴 **[https://bikepowertracker.com/](https://bikepowertracker.com/)**

## Features

| Feature | Description |
|---------|-------------|
| **Real-time Metrics** | Monitor power (watts), cadence (RPM), and heart rate (BPM) |
| **Hybrid Bluetooth** | Supports Web Bluetooth (Browser) and Native Bluetooth (Android/iOS) |
| **Auto-Reconnect** | Automatic reconnection with exponential backoff |
| **Live Streaming** | Stream your workout to viewers in real-time via Redis Streams |
| **Offline Mode** | Fully functional offline with IndexedDB persistence |
| **Crash Recovery** | Automatically restores workout data if the app closes unexpectedly |
| **Stream Viewer** | Watch other cyclists' workouts live |
| **Data Export** | Download as JSON, TCX (Garmin), FIT, or CSV |
| **PWA Install** | Install as native app on mobile/desktop |
| **Wake Lock** | Keeps screen on during workouts |
| **Dark Theme** | Eye-friendly dark interface with auto-detect |
| **Accessibility** | Screen reader support, keyboard navigation |

## Quick Start

### Prerequisites

- **Web**: Modern browser with Web Bluetooth API (Chrome, Edge, Opera)
- **Mobile**: Android 12+ or iOS 15+ (via Capacitor build)
- Bluetooth cycling sensors (power meter, cadence, heart rate)

### Local Development

```bash
# From monorepo root
pnpm install
pnpm dev:client

# Or from this directory
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

> **Note**: For Bluetooth testing without physical hardware, development builds use mock sensors by default.

## User Guide

### Connecting Bluetooth Sensors

The app automatically selects the best connection method:
*   **Browser**: Uses Web Bluetooth API (requires Chrome/Edge).
*   **Native App**: Uses native Bluetooth plugins for better background support.

1. Ensure Bluetooth is enabled on your device.
2. Click the corresponding sensor button:
   - ⚡ **Power** - For cycling power meters
   - 🔄 **Cadence** - For cadence sensors
   - ❤️ **Heart Rate** - For HR monitors
3. Select your device from the list.
4. The button will show "Connected" when paired.

### Recording a Workout

1. Connect at least one sensor.
2. Click **Start** to begin recording.
3. Your metrics will update in real-time.
4. **Auto-Save**: Data is saved to local storage every few seconds to prevent loss.

### Live Streaming

1. Open the menu (☰ button).
2. Click **📡 Start Streaming**.
3. Your workout is broadcast to the BPT Service (if configured).
4. Share your stream name with viewers.

## Architecture

### Project Structure

The project follows a modular, state-driven architecture:

```
client/
├── src/
│   ├── api/                 # API clients (Streaming, Workouts)
│   ├── components/          # Reusable Web Components
│   ├── config/              # App configuration & constants
│   ├── init/                # Initialization logic (UI, Hardware, Router)
│   ├── router/              # Client-side routing
│   ├── services/            # Core services
│   │   ├── bluetooth/       # Hybrid Bluetooth Factory (Web/Native)
│   │   └── gps/             # Geolocation services
│   ├── storage/             # Persistence (IndexedDB)
│   ├── types/               # TypeScript definitions
│   ├── ui/                  # UI modules & interactions
│   ├── utils/               # Helper functions
│   ├── views/               # Page views (Dashboard, History, Settings)
│   ├── workouts/            # Structured workout logic
│   │
│   ├── main.ts              # App entry point
│   ├── measurements-state.ts # Central state management
│   ├── stream-manager.ts    # Streaming orchestration
│   └── zone-state.ts        # Training zone calculations
│
├── public/                  # Static assets
├── test-e2e/                # Playwright E2E tests
├── index.html               # Entry HTML
└── vite.config.js           # Vite & PWA configuration
```

### Data Flow

1.  **Sensors**: Data enters via `BluetoothFactory` (normalizing Web/Native inputs).
2.  **State**: `MeasurementsState` aggregates data, validating and timestamping it.
3.  **Persistence**: Data is asynchronously written to `IndexedDB` via `workoutStorage`.
4.  **UI**: `Views` and `Components` subscribe to state changes for updates.
5.  **Streaming**: `StreamManager` samples state and pushes to the backend via SSE.

### State Management

*   **MeasurementsState**: Core workout data (Power, HR, Cadence, GPS).
*   **ConnectionsState**: Bluetooth connection status.
*   **TimeState**: Timer and recording status.
*   **ZoneState**: Power/HR zone distribution and calculating critical power.

## Development

### Running Dev Server

```bash
# Development with hot reload
pnpm dev
```

### Code Style & Quality

*   **TypeScript**: Strict mode enabled.
*   **Testing**:
    *   **Unit**: `node:test` runner.
    *   **E2E**: Playwright.
*   **Linting**: Run `pnpm typecheck` before pushing changes.

### Key Files

| File | Purpose |
|------|---------|
| `main.ts` | Bootstraps the application, router, and hardware. |
| `measurements-state.ts` | Central observable state for all sensor data. |
| `services/bluetooth/factory.ts` | Abstracts Web vs Native Bluetooth implementations. |
| `init/ui.ts` | Initializes all UI components and event listeners. |
| `storage/workoutStorage.ts` | Handles IndexedDB persistence and recovery. |

## Testing

### Unit Tests

We use the native Node.js test runner (`node:test`).

```bash
# Run unit tests
pnpm test

# Watch mode
pnpm test:watch

# Fuzz testing (Bluetooth)
pnpm test:fuzz
```

### E2E Tests (Playwright)

End-to-end tests verify critical user flows in a real browser environment.

```bash
# Run E2E tests (headless)
pnpm test:e2e

# Run with UI debugger
pnpm test:e2e:ui
```

## Configuration

### Environment Variables

Create `.env` file for local overrides (optional):

```bash
# API URL for streaming service
VITE_API_URL=http://localhost:3000

# Toggle Mock Sensors (Default: true in dev, false in prod)
VITE_USE_MOCK_SENSORS=false
```

### Building

```bash
# Build optimized bundle
pnpm build

# Build for Mobile (Capacitor)
pnpm run build:mobile
```

## Troubleshooting

### Bluetooth Issues

*   **Linux**: Check `chrome://device-log/` if sensors aren't finding.
*   **Mobile**: Ensure Location and Bluetooth permissions are granted.
*   **Mock Mode**: In development, random data is generated. Check `vite.config.js` to see alias configurations.

### Performance

If the UI feels sluggish during high-frequency data updates:
1.  Check `requestAnimationFrame` usage in `ui/streamViewer.ts`.
2.  Ensure `MeasurementsState` isn't emitting events too frequently.
