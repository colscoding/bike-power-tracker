# BPT Service - Redis Streams API

Real-time workout data streaming service for the Bike Power Tracker app. Built on Redis Streams with Server-Sent Events (SSE) support for live workout streaming.

## Overview

This service provides the backend API that enables the Bike Power Tracker PWA client to:
- Stream workout data in real-time to other users
- View live workout streams from other cyclists
- Store and retrieve workout session history
- Track analytics on streaming activity

## Features

- **Redis Streams**: Persistent, scalable message streaming
- **Server-Sent Events (SSE)**: Real-time updates to connected clients
- **RESTful API**: Create streams, send messages, retrieve history
- **Stream Management**: List and manage multiple concurrent workout streams
- **Analytics**: JSON file-based analytics tracking all streaming events
- **CORS Enabled**: Full cross-origin support for client integration

## Quick Start

### Prerequisites

- Node.js >= 14.0.0
- Redis server running (Docker or local installation)

### Installation

From the monorepo root:

```bash
pnpm install
```

### Start Redis

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:latest

# Or use Docker Compose from this directory
docker-compose up redis -d
```

### Development

```bash
# From monorepo root
pnpm dev:service

# Or from this directory
pnpm dev
```

The service will start on `http://localhost:3000`

### Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:api

# Run client integration tests
NODE_ENV=test pnpm test -- tests/client-integration.test.js
```

## API Endpoints

### Streams Management

#### Create Stream
```bash
POST /api/streams/create
Content-Type: application/json

{
  "streamName": "workout-20231122-143000"
}
```

#### List All Streams
```bash
GET /api/streams
```

Returns all active streams with metadata (message count, first/last message IDs).

#### Get Stream Messages
```bash
GET /api/streams/:streamName/messages?start=-&end=+&count=100
```

### Real-time Streaming

#### Send Workout Data
```bash
POST /api/streams/:streamName/messages
Content-Type: application/json

{
  "message": "{\"power\":250,\"cadence\":85,\"heartrate\":145,\"timestamp\":1700000000000,\"elapsed\":\"00:05:30\",\"dataType\":\"workout_metrics\"}",
  "author": "bike-power-tracker"
}
```

#### Listen to Stream (SSE)
```bash
GET /api/streams/:streamName/listen
```

Opens a Server-Sent Events connection for real-time updates.

### Analytics

```bash
GET /api/analytics/summary          # Overall statistics
GET /api/analytics/streams          # Per-stream statistics  
GET /api/analytics/activity?hours=24 # Activity timeline
GET /api/analytics/export?format=json&limit=1000  # Export data
```

## Architecture

```
Client PWA (packages/client)
    ↓ HTTP/SSE
Express Server (this package)
    ↓
Redis Streams (persistent storage)
    ↓
analytics.json (event tracking)
```

## Integration with Client

The service is designed to work seamlessly with the Bike Power Tracker PWA client:

1. **Client starts workout** → Creates stream via `/api/streams/create`
2. **Client streams data** → Sends workout metrics every second via `/api/streams/:streamName/messages`
3. **Other clients view** → Connect via SSE to `/api/streams/:streamName/listen`
4. **Real-time updates** → Server pushes new messages to all connected viewers

See [`packages/client/src/api/streamClient.js`](../client/src/api/streamClient.js) for client-side implementation.

## Environment Variables

```bash
PORT=3000              # Server port
REDIS_HOST=localhost   # Redis server host
REDIS_PORT=6379        # Redis server port
```

See [`.env.example`](./.env.example) for all available options.

## Data Format

### Workout Data Message Structure

```json
{
  "power": 250,           // Watts (or null)
  "cadence": 85,          // RPM (or null)
  "heartrate": 145,       // BPM (or null)
  "timestamp": 1700000000000,
  "elapsed": "00:05:30",  // HH:MM:SS format
  "dataType": "workout_metrics"
}
```

Messages are stored as JSON strings in Redis and parsed by viewers.

## Deployment

### Docker

```bash
# Build and run with Docker Compose
docker-compose up

# Or build manually
docker build -t bpt-service .
docker run -p 3000:3000 --env-file .env bpt-service
```

### Production

1. Ensure Redis is running and accessible
2. Set environment variables
3. Run: `npm start`

For production deployment guides, see [`docs/SETUP_SUMMARY.md`](./docs/SETUP_SUMMARY.md).

## Monitoring

Analytics are automatically tracked to `analytics.db`. Access via:

- API endpoints: `/api/analytics/*`
- Direct SQLite queries: `sqlite3 analytics.db`
- Export: `/api/analytics/export?format=csv`

## Project Structure

```
service/
├── src/                         # Source files (planned)
├── public/                      # Demo web interface (optional)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── scripts/                     # Shell scripts for testing
│   ├── create-stream.sh
│   ├── send-message.sh
│   └── ...
├── tests/                       # Test suite
│   ├── client-integration.test.js  # Client integration tests
│   ├── api.test.js                 # API endpoint tests
│   ├── redis.test.js               # Redis integration tests
│   └── unit.test.js                # Unit tests
├── docs/                        # Documentation
├── server.js                    # Express server + Redis
├── openapi.yaml                 # API specification
├── package.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

**Note:** The `public/` folder contains a standalone demo web interface from the original project. The primary client for this service is the PWA in `packages/client/`.

## Development

See documentation in [`docs/`](./docs/):
- [API Reference](./docs/API_REFERENCE.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Testing Guide](./docs/TESTING.md)
- [Docker & Testing](./docs/DOCKER_AND_TESTING.md)

## Troubleshooting

**Redis connection issues:**
```bash
# Check if Redis is running
docker ps | grep redis

# Restart Redis
docker-compose restart redis
```

**Port already in use:**
```bash
# Change PORT in .env or:
PORT=3001 pnpm dev
```

**Tests failing:**
```bash
# Ensure Redis is running for integration tests
docker-compose up redis -d
pnpm test
```

## License

MIT
├── deploy.sh                   # Deployment script
├── Makefile                    # Make commands
├── DEVELOPMENT.md              # Dev guide
├── TESTING.md                  # Testing guide
├── DOCKER_AND_TESTING.md       # Quick reference
├── SETUP_SUMMARY.md            # Complete setup summary
└── README.md                   # This file
```

## 🛠️ Technologies Used

- **Backend**: Node.js, Express
- **Database**: Redis (with Streams)
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Real-time**: Server-Sent Events (SSE)
- **Testing**: Mocha, Chai, Supertest, NYC
- **Code Quality**: ESLint, Prettier, EditorConfig
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions

## 🐳 Docker & Deployment

### Quick Docker Start
```bash
# Start everything
docker-compose up

# Development with hot-reload
docker-compose --profile dev up

# Build images
./build.sh all
```

### Deployment
```bash
./deploy.sh production
```

See [DOCKER_AND_TESTING.md](DOCKER_AND_TESTING.md) for complete Docker guide.

## 📊 NPM Scripts & Commands

```bash
npm start              # Start server
npm run dev           # Dev mode with hot-reload
npm test              # Run all tests
npm run test:coverage # Tests with coverage
npm run lint          # Check code quality
npm run format        # Format code
make help             # Show all 30+ make commands
```

## 📚 Documentation

- **[API.md](API.md)** - Complete API specification and reference
- **[ANALYTICS.md](ANALYTICS.md)** - Analytics API and usage guide
- **[openapi.yaml](openapi.yaml)** - OpenAPI 3.0 specification
- **[postman_collection.json](postman_collection.json)** - Postman collection for testing
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Complete development guide
- **[TESTING.md](TESTING.md)** - Testing documentation  
- **[DOCKER_AND_TESTING.md](DOCKER_AND_TESTING.md)** - Quick reference
- **[SETUP_SUMMARY.md](SETUP_SUMMARY.md)** - What was created

## ✅ Quality Features

- ✅ 80% test coverage
- ✅ ESLint + Prettier
- ✅ Docker production-ready
- ✅ CI/CD with GitHub Actions
- ✅ Security best practices
- ✅ Comprehensive documentation

## 📝 Development Notes

- Redis streams are persistent and will survive server restarts
- The application connects to Redis at `localhost:6379` by default
- Messages include timestamps and author information
- Stream names are case-sensitive

## 🐛 Troubleshooting

### Redis Connection Error
- Ensure Redis is running: `redis-cli ping` (should return PONG)
- Check Redis is listening on port 6379

### Cannot Create Streams
- Verify Redis version supports streams (v5.0+): `redis-server --version`

## License

MIT
