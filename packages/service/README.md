# Bike Power Tracker - Service

Node.js service using Redis Streams for real-time workout data streaming.

## Features

- **Redis Streams**: High-performance data streaming
- **Server-Sent Events (SSE)**: Real-time updates to clients
- **REST API**: Manage streams and messages
- **Dockerized**: Ready for production deployment with Nginx and Redis

## API Endpoints

### Streams

- `GET /api/streams` - List all active streams
- `POST /api/streams/create` - Create a new stream
- `DELETE /api/streams/:streamName` - Delete a stream
- `DELETE /api/streams/cleanup` - Cleanup inactive streams

### Messages

- `GET /api/streams/:streamName/messages` - Get messages from a stream
- `POST /api/streams/:streamName/messages` - Add a message to a stream
- `GET /api/streams/:streamName/listen` - Subscribe to real-time updates (SSE)

## Development

```bash
# From monorepo root
pnpm dev:service

# Or from this directory
pnpm dev
```

The service runs on `http://localhost:3000`.

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:api
pnpm test:integration
```

## Deployment

See [Deployment Guide](../../docs/DEPLOY.md) for VPS deployment instructions.
