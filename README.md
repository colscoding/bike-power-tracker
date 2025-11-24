# Bike Power Tracker

Track your spin bike: power, cadence, and heart rate with Bluetooth sensors. Stream and view live workout data.

## Live App

🚴 **[https://bikepowertracker.com/](https://bikepowertracker.com/)**

## Monorepo Structure

This is a monorepo containing both the client PWA and the streaming service:

```
bike-power-tracker/
├── packages/
│   ├── client/          # PWA application (Vite + vanilla JS)
│   └── service/         # Streaming API service (Redis Streams)
├── package.json         # Root workspace configuration
└── pnpm-workspace.yaml  # PNPM workspace definition
```

### Packages

- **[`packages/client`](./packages/client)** - Progressive Web App for tracking workouts
- **[`packages/service`](./packages/service)** - Redis Streams API for real-time data streaming

## Features

- **Real-time Metrics**: Monitor power (watts), cadence (RPM), and heart rate (BPM)
- **Bluetooth Connectivity**: Connect to Bluetooth cycling sensors
- **Live Streaming**: Stream your workout data in real-time to a server
- **Stream Viewer**: Watch live workout streams from other users
- **Timer**: Track workout duration
- **Data Export**: Download workout data as JSON, TCX, and CSV formats
- **PWA Support**: Install as a Progressive Web App on mobile and desktop
- **Offline Capable**: Works without an internet connection once installed

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended) or npm
- **Redis** (for streaming service)

### Installation

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Clone the repository
git clone https://github.com/colscoding/bike-power-tracker.git
cd bike-power-tracker

# Install all dependencies
pnpm install
```

### Development

```bash
# Start both client and service in parallel
pnpm dev

# Or start them individually:
pnpm dev:client   # Start client only (http://localhost:5173)
pnpm dev:service  # Start service only (http://localhost:3000)
```

### Building

```bash
# Build all packages
pnpm build

# Build client only
pnpm build:client
```

### Testing

```bash
# Run all tests
pnpm test

# Run client tests only
pnpm test:client

# Run E2E tests
pnpm test:e2e
```

## Live Streaming

The app can stream your workout data to a Redis Streams-based server for real-time sharing and viewing.

### Setup

1. **Start Redis** (required for streaming service):
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:latest
   
   # Or install Redis locally
   # macOS: brew install redis && redis-server
   # Linux: sudo apt-get install redis-server && redis-server
   ```

2. **Start the streaming service**:
   ```bash
   pnpm dev:service
   # Service runs on http://localhost:3000
   ```

3. **Start the client**:
   ```bash
   pnpm dev:client
   # Client runs on http://localhost:5173
   ```

### Using Live Streaming

1. **Start Streaming Your Workout**:
   - Open the menu (☰)
   - Click "📡 Start Streaming"
   - Your workout data will be broadcast in real-time
   - Click "🔴 Stop Streaming" to end the stream

2. **View Other Streams**:
   - Open the menu (☰)
   - Click "🌐 View Streams"
   - See a list of all active workout streams
   - Click "👁️ View" to watch any stream in real-time
   - View power, cadence, heart rate, and elapsed time from other cyclists

### Stream Features

- **Real-time updates**: Data is sent every second while recording
- **Server-Sent Events (SSE)**: Low-latency streaming using SSE protocol
- **Multiple viewers**: Multiple users can watch the same stream simultaneously

## Tech Stack

### Client (PWA)
- **Framework**: Vanilla JavaScript
- **Build Tool**: Vite
- **PWA**: vite-plugin-pwa with Workbox
- **Testing**: Node.js test runner, Playwright
- **Deployment**: GitHub Pages

### Service (API)
- **Runtime**: Node.js
- **Framework**: Express.js (planned)
- **Database**: Redis Streams
- **Real-time**: Server-Sent Events (SSE)
- **API Spec**: OpenAPI 3.0

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build
```
