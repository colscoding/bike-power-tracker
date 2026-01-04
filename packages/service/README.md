# Bike Power Tracker - Service

Real-time workout streaming service built with Node.js, Express, Redis Streams, and optional persistent database.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The BPT Service provides:

- **Redis Streams** for high-performance real-time data streaming
- **Server-Sent Events (SSE)** for low-latency client subscriptions
- **REST API** for stream and message management
- **Optional Database** (SQLite/PostgreSQL) for persistent workout storage
- **Docker Support** for easy deployment with Nginx reverse proxy

### Key Features

| Feature | Description |
|---------|-------------|
| Real-time Streaming | Sub-second latency using Redis Streams + SSE |
| Scalable | Handles hundreds of concurrent connections |
| Persistent Storage | Optional database for workout history |
| API Authentication | Optional API key protection |
| Production Ready | Docker Compose with Nginx, health checks |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Client PWA    │────▶│   BPT Service    │────▶│    Redis    │
│  (Vite + TS)    │◀────│  (Express + TS)  │◀────│   Streams   │
└─────────────────┘     └────────┬─────────┘     └─────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   Database       │
                        │ (SQLite/Postgres)│
                        └──────────────────┘
```

### Data Flow

1. **Client** connects to service via HTTP/SSE
2. **Service** writes workout data to Redis Streams
3. **Redis** notifies all subscribed clients via SSE
4. **Database** (optional) stores completed workouts for history

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Redis >= 6.0
- pnpm >= 8.0.0

### Local Development

```bash
# Start Redis (choose one method)
docker run -d -p 6379:6379 --name redis redis:alpine

# Or install locally:
# macOS: brew install redis && redis-server
# Linux: sudo apt install redis-server && redis-server

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The service runs on `http://localhost:3000`.

### Docker Compose (Recommended)

The service includes Docker Compose configurations for both production and development.

```bash
# Start Production Service (standalone)
# This starts the service and redis on port 3000
docker compose up -d

# Start Development Service (with hot reload)
# This starts the service in watch mode on port 3001
docker compose --profile dev up

# Start Full Production Stack (with Nginx)
# This starts service, redis, and nginx on port 80
docker compose -f docker-compose.prod.yml up -d
```

## API Reference

### Base URL

- Development: `http://localhost:3000`
- Production: Configure via `CORS_ORIGIN`

### Authentication

If `API_KEY` is set, all requests must include authentication:
- Header (recommended): `X-API-Key: your-api-key`
- Query (deprecated, for SSE backwards compatibility): `?apiKey=your-api-key`

> **Note**: Query string authentication is deprecated and logs a security warning. Use the header method for all new implementations.

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "redis": "connected",
  "database": "connected",
  "timestamp": "2024-12-30T12:00:00.000Z"
}
```

---

### Streams API

#### List All Streams

```http
GET /api/streams
```

**Response:**
```json
{
  "streams": [
    {
      "name": "workout-user123",
      "length": 150,
      "firstMessageId": "1703936400000-0",
      "lastMessageId": "1703936550000-0"
    }
  ]
}
```

#### Create Stream

```http
POST /api/streams/create
Content-Type: application/json

{
  "streamName": "workout-user123"
}
```

**Response:**
```json
{
  "success": true,
  "streamName": "workout-user123",
  "messageId": "1703936400000-0"
}
```

#### Delete Stream

```http
DELETE /api/streams/:streamName
```

#### Cleanup Inactive Streams

```http
DELETE /api/streams/cleanup
```

---

### Messages API

#### Send Message

```http
POST /api/streams/:streamName/messages
Content-Type: application/json

{
  "message": "{\"power\":245,\"cadence\":92,\"heartrate\":155}",
  "author": "cyclist-1"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "1703936400123-0",
  "streamName": "workout-user123"
}
```

#### Get Messages

```http
GET /api/streams/:streamName/messages?start=-&end=+&count=100
```

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `start` | `-` | Starting message ID (use `-` for first) |
| `end` | `+` | Ending message ID (use `+` for last) |
| `count` | `100` | Maximum messages to return (max: 1000) |

---

### Real-time API (SSE)

#### Subscribe to Stream

```http
GET /api/streams/:streamName/listen
Accept: text/event-stream
```

#### Subscribe to All Streams

```http
GET /api/streams/listenAll
Accept: text/event-stream
```

**Event Types:**
```javascript
// Connection established
{ "type": "connected", "streamName": "workout-user123" }

// New message received
{ 
  "type": "message",
  "stream": "workout-user123",
  "id": "1703936400123-0",
  "data": { "power": 245, "cadence": 92, "heartrate": 155 }
}

// Stream deleted
{ "type": "stream_deleted", "streamName": "workout-user123" }
```

**JavaScript Client Example:**
```javascript
const eventSource = new EventSource('/api/streams/my-workout/listen');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'message') {
    console.log('New data:', data.data);
  }
};

eventSource.onerror = () => {
  console.log('Connection lost, reconnecting...');
};
```

---

### OpenAPI Specification

Full API documentation is available in `openapi.yaml`. View it with:

```bash
# Using Swagger Editor online
# 1. Go to https://editor.swagger.io
# 2. File → Import File → Select openapi.yaml

# Or serve locally with Swagger UI
npx swagger-ui-express -p 8080 openapi.yaml
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | - | Redis password (optional) |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `API_KEY` | - | API authentication key (optional) |
| `DATABASE_URL` | - | Database connection string |

### Example `.env` File

```bash
# Server
PORT=3000
NODE_ENV=production

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Security
API_KEY=your-secret-api-key
CORS_ORIGIN=https://bikepowertracker.com

# Database (optional)
DATABASE_URL=file:./data/bpt.db
```

## Database Setup

The service supports optional persistent storage for workouts.

### SQLite (Default, Recommended for Single Server)

```bash
# Set database URL
export DATABASE_URL="file:./data/bpt.db"

# Generate Prisma client
pnpm prisma generate

# Create database and tables
pnpm prisma db push
```

### PostgreSQL (For Scaling)

```bash
# Set database URL
export DATABASE_URL="postgresql://user:password@localhost:5432/bpt"

# Generate and migrate
pnpm prisma generate
pnpm prisma migrate deploy
```

### Database Schema

```prisma
model User {
  id        String    @id @default(uuid())
  email     String?   @unique
  name      String?
  workouts  Workout[]
  createdAt DateTime  @default(now())
}

model Workout {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  startTime    DateTime
  endTime      DateTime?
  duration     Int?
  avgPower     Float?
  maxPower     Float?
  avgHeartrate Float?
  maxHeartrate Float?
  avgCadence   Float?
  status       String   @default("active")
  data         Json?
  createdAt    DateTime @default(now())
}
```

## Development

### Project Structure

```
service/
├── src/
│   ├── server.ts       # Main Express server entry point
│   ├── config.ts       # Configuration and environment
│   ├── redis.ts        # Redis client and connection pooling
│   ├── utils.ts        # Utility functions
│   ├── validation.ts   # Input validation middleware
│   ├── middleware/     # Express middleware
│   │   ├── auth.ts     # API key authentication
│   │   ├── cors.ts     # CORS configuration
│   │   └── index.ts    # Middleware exports
│   ├── routes/         # API route handlers
│   │   ├── health.ts   # Health check endpoint
│   │   ├── streams.ts  # Stream CRUD + SSE endpoints
│   │   ├── workouts.ts # Workout API (database)
│   │   ├── users.ts    # User API (database)
│   │   └── index.ts    # Route exports
│   ├── db/             # Database layer (Prisma)
│   │   ├── index.ts        # Prisma client
│   │   ├── workoutService.ts # Workout operations
│   │   └── userService.ts    # User operations
│   └── types/          # TypeScript definitions
│       ├── workout.ts
│       ├── user.ts
│       ├── stream.ts
│       └── db.ts
├── tests/
│   ├── unit.test.js          # Unit tests
│   ├── api.test.js           # API integration tests
│   ├── workoutApi.test.js    # Workout API tests
│   ├── workoutService.test.js # Workout service tests
│   ├── userService.test.js   # User service tests
│   ├── redis.test.js         # Redis connection tests
│   ├── security.test.js      # Security/validation tests
│   └── client-integration.test.js
├── prisma/
│   └── schema.prisma     # Database schema
├── nginx/
│   └── default.conf      # Nginx configuration
├── docker-compose.yml      # Development Docker config
├── docker-compose.prod.yml # Production Docker config
├── Dockerfile              # Production image
├── Dockerfile.dev          # Development image
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint 9 flat config
├── openapi.yaml            # API specification
└── package.json
```

### Running Locally

```bash
# Development with hot reload
pnpm dev

# Run specific script
node src/server.js
```

### Code Style

The project uses ESLint 9 (flat config) and follows Node.js best practices:

- TypeScript with strict mode
- ES Modules (`"type": "module"`)
- Async/await for asynchronous code
- JSDoc comments for documentation
- Error handling with try/catch
- Input validation middleware

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit     # Unit tests only
pnpm test:api      # API tests only
pnpm test:redis    # Redis tests only

# Run with coverage
pnpm test -- --coverage

# Watch mode
pnpm test -- --watch
```

### Test Structure

| File | Description |
|------|-------------|
| `unit.test.js` | Pure function tests, utilities |
| `api.test.js` | HTTP endpoint tests |
| `workoutApi.test.js` | Workout endpoint tests |
| `workoutService.test.js` | Workout service layer tests |
| `userService.test.js` | User/password service tests |
| `redis.test.js` | Redis connection and stream tests |
| `security.test.js` | Input validation and security tests |
| `client-integration.test.js` | End-to-end client flows |

**Total: 115+ tests across 8 test files**

## Deployment

### Docker Production Build

```bash
# Build production image
docker build -t bpt-service .

# Run with Redis
docker-compose -f docker-compose.prod.yml up -d
```

### VPS Deployment

See detailed guides in the `docs/` folder:

- [DEPLOY.md](../../docs/DEPLOY.md) - VPS deployment guide
- [HOME_DEPLOYMENT.md](../../docs/HOME_DEPLOYMENT.md) - Home server setup
- [TUNNEL_OPTIONS.md](../../docs/TUNNEL_OPTIONS.md) - Cloudflare tunnel setup

### Production Checklist

- [ ] Set strong `API_KEY`
- [ ] Configure `CORS_ORIGIN` for your domain
- [ ] Set `NODE_ENV=production`
- [ ] Enable Redis authentication
- [ ] Set up SSL/TLS (via Nginx or Cloudflare)
- [ ] Configure health check monitoring
- [ ] Set up log aggregation

## Troubleshooting

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check connection settings
echo $REDIS_HOST $REDIS_PORT
```

### SSE Connection Drops

Common causes:
1. **Proxy timeout**: Configure Nginx/load balancer for long-lived connections
2. **Keep-alive**: Ensure no intermediary is closing idle connections

Nginx config for SSE:
```nginx
location /api/streams {
    proxy_pass http://service:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
}
```

### High Memory Usage

- Implement stream message limits (XTRIM)
- Clean up inactive streams periodically
- Monitor with `redis-cli INFO memory`

### Database Migration Issues

```bash
# Reset database (development only!)
pnpm prisma db push --force-reset

# Check migration status
pnpm prisma migrate status
```

## License

ISC
