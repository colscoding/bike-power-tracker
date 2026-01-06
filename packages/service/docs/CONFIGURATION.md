# Configuration

The service is configured primarily via Environment Variables.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the Express server listens on. |
| `NODE_ENV` | `development` | `development`, `production`, or `test`. |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`). |
| `CORS_ORIGIN` | `*` | Allowed CORS origins. Set to client URL in production. |
| `DATABASE_URL` | - | **Required**. Connection string for Prisma (PostgreSQL or SQLite file path). |
| `REDIS_HOST` | `localhost` | Hostname for Redis connection. |
| `REDIS_PORT` | `6379` | Port for Redis connection. |
| `REDIS_PASSWORD` | - | Password for Redis authentication. |
| `API_KEY` | - | Master API Key for administrative access (if enabled). |

## Validation Constants

Hardcoded validation rules in `src/config.ts`:

-   **Stream Name**: Max 64 chars, alphanumeric + `_` + `-`.
-   **Message Size**: Max 100KB per message.
-   **Author Name**: Max 64 chars.

## Logging

The service uses a custom logger wrapper (likely built on `pino` or `winston`, check `src/logger.ts`).
-   In `development`, logs are pretty-printed.
-   In `production`, logs are typically JSON formatted for ingestion by log aggregators.
