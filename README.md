# Bike Power Tracker

Track your cycling workouts with Bluetooth sensors. Monitor power, cadence, and heart rate in real-time. Stream your workouts live and view others.

🚴 **Live App: [https://bikepowertracker.com/](https://bikepowertracker.com/)**

## Features

| Feature | Description |
|---------|-------------|
| ⚡ **Real-time Metrics** | Monitor power (watts), cadence (RPM), and heart rate (BPM) |
| 📶 **Bluetooth Sensors** | Connect to BLE cycling power meters, cadence, and HR monitors |
| 📡 **Live Streaming** | Stream your workout data in real-time to viewers |
| 👁️ **Stream Viewer** | Watch live workout streams from other cyclists |
| ⏱️ **Workout Timer** | Track workout duration with start/stop/reset |
| 📊 **Data Export** | Download workouts as JSON, TCX (Garmin), or CSV |
| 📱 **PWA Support** | Install as an app on mobile and desktop |
| 🔌 **Offline Mode** | Works without internet once installed |

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Redis** >= 6.0 (for streaming service)

### Installation

```bash
# Clone the repository
git clone https://github.com/colscoding/bike-power-tracker.git
cd bike-power-tracker

# Install dependencies
pnpm install
```

### Development

```bash
# Start both client and service
pnpm dev

# Or start individually:
pnpm dev:client   # Client at http://localhost:5173
pnpm dev:service  # Service at http://localhost:3000
```

### Quick Redis Setup

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 --name redis redis:alpine

# Or install locally:
# macOS: brew install redis && redis-server
# Linux: sudo apt install redis-server && redis-server
```

## Monorepo Structure

```
bike-power-tracker/
├── packages/
│   ├── client/          # PWA application (Vite + vanilla JS)
│   ├── service/         # Streaming API (Express + Redis Streams)
│   └── simulation/      # Testing & simulation tools
├── test-integration/    # Cross-package integration tests
├── docs/                # Documentation
│   ├── DEPLOY.md        # VPS deployment guide
│   ├── HOME_DEPLOYMENT.md    # Home server setup
│   └── TUNNEL_OPTIONS.md     # Cloudflare tunnel guide
├── package.json         # Root workspace config
└── pnpm-workspace.yaml  # PNPM workspace definition
```

### Packages

| Package | Description | Docs |
|---------|-------------|------|
| **[client](./packages/client)** | PWA for tracking workouts | [README](./packages/client/README.md) |
| **[service](./packages/service)** | Real-time streaming API | [README](./packages/service/README.md) |
| **[simulation](./packages/simulation)** | Testing & simulation tools | [README](./packages/simulation/README.md) |

## Tech Stack

### Client (PWA)
- **Language**: Vanilla JavaScript (ES Modules)
- **Build Tool**: Vite
- **PWA**: vite-plugin-pwa + Workbox
- **Testing**: Node.js test runner, Playwright
- **Deployment**: GitHub Pages

### Service (API)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Real-time**: Redis Streams + Server-Sent Events (SSE)
- **Database**: SQLite/PostgreSQL (optional, via Prisma)
- **API Spec**: OpenAPI 3.0
- **Deployment**: Docker + Nginx

## Using the App

### 1. Connect Your Sensors

1. Open the app in Chrome, Edge, or Opera
2. Click the sensor buttons (Power/Cadence/HR)
3. Select your device from the Bluetooth dialog
4. Sensors show "Connected" when paired

### 2. Record a Workout

1. Connect at least one sensor
2. Click **Start** to begin recording
3. Watch your metrics update in real-time
4. Click **Stop** when finished

### 3. Stream Your Workout

1. Open the menu (☰)
2. Click **📡 Start Streaming**
3. Share your stream with viewers
4. Click **🔴 Stop Streaming** to end

### 4. View Other Streams

1. Open the menu (☰)
2. Click **🌐 View Streams**
3. Click **👁️ View** on any active stream

### 5. Export Your Data

After recording, use the menu to export:
- **JSON** - Raw data for analysis
- **TCX** - For Garmin Connect, Strava
- **CSV** - For spreadsheets

## Commands Reference

### Development

```bash
pnpm dev              # Start client + service
pnpm dev:client       # Start client only
pnpm dev:service      # Start service only
```

### Building

```bash
pnpm build            # Build all packages
pnpm build:client     # Build client only
```

### Testing

```bash
pnpm test             # Run all unit tests
pnpm test:client      # Client unit tests
pnpm test:service     # Service unit tests
pnpm test:e2e         # Client E2E tests (Playwright)
pnpm test:integration # Cross-package integration tests
```

### Simulation Tools

```bash
cd packages/simulation

pnpm start            # Single user simulation
pnpm multi            # Multi-user simulation
pnpm viewer           # Watch streams in terminal
pnpm stress           # Performance stress test
```

## Bluetooth Compatibility

### Supported Browsers

| Browser | Support |
|---------|---------|
| Chrome | ✅ Full |
| Edge | ✅ Full |
| Opera | ✅ Full |
| Firefox | ❌ No Web Bluetooth |
| Safari | ❌ No Web Bluetooth |

### Tested Sensors

**Power Meters:** Favero Assioma, Garmin Vector, 4iiii, Stages, Quarq

**Cadence:** Garmin, Wahoo RPM, Magene S3+

**Heart Rate:** Garmin HRM-Pro, Wahoo TICKR, Polar H10

## Deployment

### GitHub Pages (Client Only)

The client auto-deploys to GitHub Pages on push to main.

### Full Stack Deployment

For deploying both client and service:

| Guide | Description |
|-------|-------------|
| [DEPLOY.md](./docs/DEPLOY.md) | VPS deployment with Docker |
| [HOME_DEPLOYMENT.md](./docs/HOME_DEPLOYMENT.md) | Home server setup |
| [TUNNEL_OPTIONS.md](./docs/TUNNEL_OPTIONS.md) | Cloudflare tunnel for home servers |

### Docker Quick Deploy

```bash
cd packages/service

# Development
docker-compose up

# Production (with Nginx)
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration

### Environment Variables

**Client** (`.env`):
```bash
VITE_API_URL=https://api.bikepowertracker.com
```

**Service** (`.env`):
```bash
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
API_KEY=your-secret-key
CORS_ORIGIN=https://bikepowertracker.com
DATABASE_URL=file:./data/bpt.db
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a pull request

## Documentation

| Document | Description |
|----------|-------------|
| [Client README](./packages/client/README.md) | Client development guide |
| [Service README](./packages/service/README.md) | Service API documentation |
| [Simulation README](./packages/simulation/README.md) | Testing tools |
| [DEPLOY.md](./docs/DEPLOY.md) | VPS deployment |
| [HOME_DEPLOYMENT.md](./docs/HOME_DEPLOYMENT.md) | Home server guide |
| [TUNNEL_OPTIONS.md](./docs/TUNNEL_OPTIONS.md) | Tunnel setup |
| [OpenAPI Spec](./packages/service/openapi.yaml) | Full API specification |

## License

ISC
