# Database Implementation Plan

This document outlines the strategy for introducing a persistent database to the Bike Power Tracker service.

## Related Documentation

For detailed implementation guides, see:
- [PostgreSQL Implementation Guide](DATABASE_POSTGRESQL.md) - Recommended for production
- [SQLite Implementation Guide](DATABASE_SQLITE.md) - Recommended for self-hosted/single-user
- [MongoDB Implementation Guide](DATABASE_MONGODB.md) - Alternative for flexible schemas

## 1. Motivation

Currently, the service relies entirely on Redis. While Redis is excellent for real-time streams and ephemeral data, a persistent database is required for:
*   **User Management**: Storing user profiles and credentials securely.
*   **Workout History**: Keeping a permanent log of past workouts.
*   **Analytics**: Querying historical data (e.g., "Best 20-minute power", "Total distance this month").
*   **Memory Management**: Offloading completed workout data from Redis (RAM) to disk storage.

## 2. What to Store

### A. Users
*   **Identity**: `id` (UUID), `email`, `provider_id` (for OAuth).
*   **Profile**: `display_name`, `avatar_url`.
*   **Metadata**: `created_at`, `last_login`.

### B. Workouts (Sessions)
*   **Core**: `id` (UUID), `user_id` (Foreign Key), `start_time`, `end_time`.
*   **Context**: `title` (e.g., "Morning Ride"), `notes`.
*   **Summary Metrics**: `avg_power`, `max_power`, `avg_cadence`, `total_energy` (kJ), `duration`.
*   **Status**: `active`, `completed`.

### C. Telemetry (Archived Data)
*   *Strategy*: While Redis handles live high-frequency data, completed workouts should be archived.
*   **Storage**: Store the full time-series data as a compressed JSON blob within the Workout record, or use a dedicated time-series table if granular analysis is needed later.

## 3. Database Options

### Option A: PostgreSQL (Recommended for Production)
*   **Type**: Relational (SQL).
*   **Pros**: Robust, excellent JSONB support for flexible data, strong ecosystem, standard for Node.js services.
*   **Cons**: Requires running another container.
*   **Verdict**: Best choice for structured user/workout data mixed with JSON metrics.
*   **Details**: See [PostgreSQL Implementation Guide](DATABASE_POSTGRESQL.md)

### Option B: SQLite (Recommended for Self-Hosted)
*   **Type**: Embedded SQL.
*   **Pros**: Zero configuration, single file, no extra container needed, low resource usage.
*   **Cons**: Limited concurrent write performance; single-user scenarios only.
*   **Verdict**: Ideal for home servers, Raspberry Pi, and single-user deployments.
*   **Details**: See [SQLite Implementation Guide](DATABASE_SQLITE.md)

### Option C: MongoDB
*   **Type**: Document (NoSQL).
*   **Pros**: Native JSON storage, flexible schema, powerful aggregation framework.
*   **Cons**: Higher memory usage, weaker support for relationships compared to SQL.
*   **Verdict**: Good for rapidly evolving schemas or when horizontal scaling is needed.
*   **Details**: See [MongoDB Implementation Guide](DATABASE_MONGODB.md)

### Comparison Matrix

| Feature | PostgreSQL | SQLite | MongoDB |
|---------|------------|--------|---------|
| **Setup Complexity** | Medium | Low | Medium |
| **Container Required** | Yes | No | Yes |
| **Concurrent Users** | Excellent | Limited | Good |
| **Memory Usage** | Medium | Low | High |
| **JSON Support** | JSONB (excellent) | JSON text | Native |
| **Migrations** | Prisma | Prisma | Schema-less |
| **Backup Complexity** | Medium | Low (file copy) | Medium |
| **Best For** | Production, multi-user | Home server, single-user | Flexible schemas |

## 4. Implementation Strategy

We will use **PostgreSQL** combined with **Prisma ORM**. Prisma provides type safety, easy migrations, and a modern API.

### Phase 1: Infrastructure
1.  **Docker**: Add a `postgres` service to `docker-compose.yml`.
2.  **Environment**: Add `DATABASE_URL` to `.env`.

### Phase 2: Schema Design (Prisma)

```prisma
// schema.prisma

model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?
  workouts  Workout[]
  createdAt DateTime  @default(now())
}

model Workout {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  startTime DateTime  @default(now())
  endTime   DateTime?
  title     String?
  
  // Summary statistics stored as JSON
  summary   Json?     // { avgPower: 200, maxHr: 150, ... }
  
  // Full archived data (optional, moved from Redis on completion)
  data      Json?
  
  status    String    @default("active") // "active", "completed"
}
```

### Phase 3: Application Logic

1.  **Start Workout**:
    *   Create a `Workout` record in Postgres (Status: 'active').
    *   Create the Redis Stream (as currently done).
2.  **End Workout**:
    *   Calculate summary statistics from the Redis Stream.
    *   Update the `Workout` record in Postgres with `endTime` and `summary`.
    *   (Optional) Read all Redis messages, compress them, store in `Workout.data`, and delete the Redis Stream.
3.  **History API**:
    *   Create `GET /api/workouts` to list past sessions.
    *   Create `GET /api/workouts/:id` to get details.

## 5. Migration Plan

### Quick Start (PostgreSQL)

1.  Install dependencies: `npm install prisma @prisma/client`.
2.  Initialize Prisma: `npx prisma init`.
3.  Define schema (see [PostgreSQL guide](DATABASE_POSTGRESQL.md#schema-design)).
4.  Update `docker-compose.yml` with PostgreSQL service.
5.  Run migrations: `npx prisma migrate dev`.
6.  Refactor `server.js` to use database service layer.

### Quick Start (SQLite)

1.  Install dependencies: `npm install prisma @prisma/client`.
2.  Initialize Prisma: `npx prisma init --datasource-provider sqlite`.
3.  Define schema (see [SQLite guide](DATABASE_SQLITE.md#schema-design)).
4.  Create data directory and run migrations.
5.  Mount volume for persistence in Docker.

### Quick Start (MongoDB)

1.  Install dependencies: `npm install mongoose`.
2.  Define Mongoose models (see [MongoDB guide](DATABASE_MONGODB.md#schema-design)).
3.  Add MongoDB to `docker-compose.yml`.
4.  Integrate with server.js.

## 6. Decision Guide

**Choose PostgreSQL if:**
- You have multiple users
- You need robust data integrity
- You're deploying to a VPS or cloud
- You want SQL querying capabilities

**Choose SQLite if:**
- Single user / personal use
- Running on Raspberry Pi or low-power device
- You want minimal operational overhead
- Simpler backup (just copy the file)

**Choose MongoDB if:**
- Schema is rapidly evolving
- Heavy use of aggregation pipelines
- Planning for horizontal scaling
- Team is more familiar with MongoDB
