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
| **Bluetooth Support** | Connect to BLE cycling sensors |
| **Auto-Reconnect** | Automatic reconnection with exponential backoff (max 5 attempts) |
| **Live Streaming** | Stream your workout to viewers in real-time |
| **Stream Viewer** | Watch other cyclists' workouts live |
| **Workout Timer** | Track elapsed time with start/stop/reset |
| **Data Export** | Download as JSON, TCX (Garmin), FIT, or CSV |
| **PWA Install** | Install as native app on mobile/desktop |
| **Offline Mode** | Works without internet once installed |
| **Wake Lock** | Keeps screen on during workouts |
| **Dark Theme** | Eye-friendly dark interface with auto-detect |
| **Keyboard Shortcuts** | Space (start/stop), Escape, M, S, H, E |
| **Accessibility** | Screen reader support, reduced motion, focus indicators |

## Quick Start

### Prerequisites

- Modern browser with Web Bluetooth API (Chrome, Edge, or Opera)
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

### Using the App

1. **Connect Sensors** - Click the sensor buttons (Power/Cadence/HR) to pair
2. **Start Recording** - Click "Start" to begin tracking
3. **View Metrics** - Watch real-time power, cadence, and heart rate
4. **Export Data** - Use the menu to download your workout data

## User Guide

### Connecting Bluetooth Sensors

1. Ensure Bluetooth is enabled on your device
2. Put your sensors in pairing mode
3. Click the corresponding button in the app:
   - ⚡ **Power** - For cycling power meters
   - 🔄 **Cadence** - For cadence sensors
   - ❤️ **Heart Rate** - For HR monitors
4. Select your device from the browser's Bluetooth dialog
5. The button will show "Connected" when paired

### Recording a Workout

1. Connect at least one sensor
2. Click **Start** to begin recording
3. Your metrics will update in real-time
4. Click **Stop** to pause, **Reset** to clear data

### Live Streaming

1. Open the menu (☰ button)
2. Click **📡 Start Streaming**
3. Your workout is now broadcast to the server
4. Share your stream name with viewers
5. Click **🔴 Stop Streaming** when done

### Viewing Other Streams

1. Open the menu (☰ button)
2. Click **🌐 View Streams**
3. See all active workout streams
4. Click **👁️ View** on any stream
5. Watch real-time metrics from other cyclists

### Exporting Data

After recording, use the menu to export:

| Format | Description | Use For |
|--------|-------------|---------|
| **JSON** | Raw data with all details | Analysis, backup |
| **TCX** | Training Center XML | Garmin Connect, Strava |
| **FIT** | Flexible and Interoperable Data Transfer | Garmin devices, TrainingPeaks |
| **CSV** | Comma-separated values | Excel, Google Sheets |

### Installing as PWA

**Desktop (Chrome/Edge):**
1. Click the install icon in the address bar
2. Or: Menu → Install Bike Power Tracker

**Mobile (Android):**
1. Open the app in Chrome
2. Tap "Add to Home Screen" banner
3. Or: Menu → Add to Home Screen

**iOS Safari:**
1. Tap the Share button
2. Tap "Add to Home Screen"

## Bluetooth Sensors

### Supported Protocols

| Protocol | Sensors |
|----------|---------|
| Cycling Power (0x1818) | Power meters, smart trainers |
| Cycling Speed/Cadence (0x1816) | Cadence sensors |
| Heart Rate (0x180D) | Heart rate monitors |

### Compatible Sensors (Tested)

**Power Meters:**
- Favero Assioma
- Garmin Vector
- 4iiii Precision
- Stages Power
- Quarq

**Cadence Sensors:**
- Garmin Cadence Sensor
- Wahoo RPM
- Magene S3+

**Heart Rate Monitors:**
- Garmin HRM-Pro
- Wahoo TICKR
- Polar H10
- Generic BLE HR straps

### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Best experience |
| Edge | ✅ Full | Chromium-based |
| Opera | ✅ Full | Chromium-based |
| Firefox | ❌ None | Web Bluetooth not supported |
| Safari | ❌ None | Web Bluetooth not supported |

## Architecture

### Project Structure

```
client/
├── src/
│   ├── main.ts              # App initialization
│   ├── main.css             # Global styles
│   ├── elements.ts          # DOM element references
│   ├── MeasurementsState.ts # State management
│   ├── streamManager.ts     # Streaming logic
│   │
│   ├── connect-*.ts         # Bluetooth connections
│   │   ├── connect-power.ts
│   │   ├── connect-cadence.ts
│   │   └── connect-heartrate.ts
│   │
│   ├── api/                 # API clients
│   │   ├── streamClient.ts  # Real-time streaming
│   │   └── workoutClient.ts # Workout history
│   │
│   ├── ui/                  # UI components
│   │   ├── accessibility.ts # Keyboard shortcuts, screen reader
│   │   ├── menu.ts          # Menu panel
│   │   ├── settings.ts      # Settings panel
│   │   ├── streamViewer.ts  # Stream viewing
│   │   ├── notifications.ts # Toast notifications
│   │   ├── time.ts          # Timer display
│   │   ├── wakeLock.ts      # Screen wake lock
│   │   ├── installPrompt.ts # PWA install
│   │   └── serviceWorker.ts # SW registration
│   │
│   ├── types/               # TypeScript definitions
│   │   ├── measurements.ts
│   │   ├── bluetooth.ts
│   │   ├── stream.ts
│   │   └── ...              # Other types
│   │
│   ├── create-csv.ts        # CSV export
│   ├── create-tcx.ts        # TCX export
│   ├── create-fit.ts        # FIT export
│   └── merge-measurements.ts # Data merging
│
├── public/
│   ├── assets/              # Icons, screenshots
│   ├── clear-cache.html     # Cache clearing utility
│   └── clear-sw.js          # Service worker cleaner
│
├── test-e2e/                # Playwright E2E tests
├── index.html               # Entry point
├── manifest.json            # PWA manifest
├── tsconfig.json            # TypeScript config
└── vite.config.js           # Vite configuration
```

### Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Bluetooth  │────▶│ MeasurementsState│────▶│   Display   │
│   Sensors   │     │   (State Mgmt)   │     │   (UI)      │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Stream Client   │────▶ BPT Service
                    │   (Optional)     │
                    └──────────────────┘
```

### State Management

The app uses `MeasurementsState` class for state management:

```javascript
// State structure
{
  isRecording: boolean,
  elapsedTime: number,
  measurements: [
    { timestamp, power, cadence, heartrate }
  ],
  currentValues: {
    power: number | null,
    cadence: number | null,
    heartrate: number | null
  }
}
```

## Development

### Running Dev Server

```bash
# Development with hot reload
pnpm dev

# Development with service (streaming)
pnpm dev:all  # Runs client + service
```

### Dev Server Features

- **Hot Module Replacement** - Instant updates without refresh
- **Service Worker Disabled** - No caching issues in development
- **API Proxy** - `/api` requests proxied to service

### Code Style

- TypeScript with strict mode (ES Modules)
- JSDoc comments for documentation
- Type definitions in `src/types/`

### Key Files

| File | Purpose |
|------|---------|
| `main.ts` | App initialization, event wiring |
| `MeasurementsState.ts` | Central state management |
| `streamManager.ts` | Streaming to server |
| `connect-*.ts` | Bluetooth GATT connections |
| `api/streamClient.ts` | SSE streaming client |
| `elements.ts` | DOM element references |

## Testing

### Unit Tests

```bash
# Run unit tests
pnpm test

# Watch mode
pnpm test -- --watch
```

Unit tests cover:
- `MeasurementsState.ts` - State management logic
- `streamManager.ts` - Streaming initialization and control
- `create-csv.ts` - CSV generation
- `create-tcx.ts` - TCX generation
- `create-fit.ts` - FIT file generation
- `merge-measurements.ts` - Data merging
- `getTimestring.ts` - Time formatting
- `connect-*.ts` - Bluetooth connection mocking
- `ui/notifications.ts` - Notification utilities
- `ui/time.ts` - Timer display logic
- `ui/modal.ts` - Modal component

**Total: 176 tests across 13 test files**

### E2E Tests (Playwright)

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e -- --ui

# Run specific test file
pnpm test:e2e -- power.spec.js
```

E2E tests cover:
- Bluetooth connection flows (mocked)
- Recording start/stop
- Data export
- Streaming

### Test Files

```
test-e2e/
├── power.spec.js      # Power meter tests
├── cadence.spec.js    # Cadence sensor tests
├── heartrate.spec.js  # Heart rate tests
├── workout.spec.js    # Recording workflow
├── export.spec.js     # Data export tests
└── playwright.config.js
```

## Configuration

### Environment Variables

Create `.env` file:

```bash
# API URL for streaming service
# Leave empty to use Vite proxy (recommended for dev)
VITE_API_URL=

# For production, set to your service URL:
# VITE_API_URL=https://api.bikepowertracker.com
```

### Vite Configuration

Key settings in `vite.config.js`:

```javascript
export default defineConfig({
  // Development proxy to service
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000'
    }
  },
  
  // PWA configuration
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
});
```

### PWA Manifest

The `manifest.json` configures:
- App name and description
- Icons for all platforms
- Theme and background colors
- Display mode (standalone)
- Start URL

## Building

### Production Build

```bash
# Build optimized bundle
pnpm build

# Output in dist/ directory
```

### Build Output

```
dist/
├── index.html           # Entry point
├── assets/
│   ├── index-[hash].js  # Bundled JavaScript
│   ├── index-[hash].css # Bundled CSS
│   └── ...              # Other assets
├── sw.js                # Service worker
├── manifest.webmanifest # PWA manifest
└── ...                  # Static files
```

### Preview Production Build

```bash
pnpm preview
# Opens http://localhost:4173
```

## Deployment

### GitHub Pages

The client is automatically deployed to GitHub Pages:

```bash
# Manual deploy
pnpm build
# Push dist/ to gh-pages branch
```

### Custom Domain

1. Build the client: `pnpm build`
2. Deploy `dist/` to your web server
3. Ensure HTTPS is enabled (required for PWA)
4. Set `VITE_API_URL` to your service URL

### Full Stack Deployment

For deploying client + service together, see:
- [DEPLOY.md](../../docs/DEPLOY.md) - VPS guide
- [HOME_DEPLOYMENT.md](../../docs/HOME_DEPLOYMENT.md) - Home server

## Troubleshooting

### Bluetooth Issues

**"Bluetooth not available"**
- Use Chrome, Edge, or Opera (Firefox/Safari don't support Web Bluetooth)
- Ensure Bluetooth is enabled on your device
- On Linux, you may need to enable experimental features:
  ```
  chrome://flags/#enable-experimental-web-platform-features
  ```

**Sensor not found**
- Put sensor in pairing mode (check manual)
- Ensure sensor isn't connected to another device
- Try restarting Bluetooth on your device

**Connection drops**
- Keep device within range (10m)
- Check sensor battery
- Some sensors disconnect after inactivity

### Cache Issues in Development

The service worker is **disabled in development**. If you still see stale content:

**Option 1: Hard Reload**
- Chrome/Edge: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

**Option 2: Clear Service Worker**
1. Open DevTools (F12)
2. Application tab → Clear Storage
3. Click "Clear site data"

**Option 3: Use Helper Script**
- Visit `http://localhost:5173/clear-sw.js`
- This unregisters service workers and clears caches

### PWA Not Installing

- Ensure you're using HTTPS (or localhost)
- Check `manifest.json` is valid
- Look for errors in DevTools Console
- Try Chrome's Lighthouse PWA audit

### Streaming Not Working

1. Verify service is running: `curl http://localhost:3000/health`
2. Check API URL in settings
3. Look for CORS errors in DevTools Console
4. Ensure API key matches (if configured)

### Data Export Issues

**TCX file invalid:**
- Ensure workout has data before exporting
- Check for valid timestamps

**CSV encoding issues:**
- The file uses UTF-8 encoding
- If Excel shows garbled text, import as UTF-8

## License

ISC
