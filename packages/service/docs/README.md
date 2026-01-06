# Service Documentation

Welcome to the documentation for the Bike Power Tracker Service.

## Contents

-   [Architecture](ARCHITECTURE.md): High-level system design and technology stack.
-   [API Reference](API.md): Endpoints, request/response formats, and real-time capabilities.
-   [Database](DATABASE.md): Data models (PostgreSQL/SQLite) and Redis Streams integration.
-   [Configuration](CONFIGURATION.md): Environment variables and settings.
-   [Deployment](DEPLOYMENT.md): Docker setup and deployment scripts.

## Quick Start

1.  Copy `.env.example` to `.env` and adjust settings.
2.  Start infrastructure: `docker-compose up -d redis db`
3.  Run migrations: `npx prisma migrate dev`
4.  Start dev server: `npm run dev`
