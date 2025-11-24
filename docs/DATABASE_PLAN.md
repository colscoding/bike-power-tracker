# Database Implementation Plan

This document outlines the strategy for introducing a persistent relational database to the Bike Power Tracker service.

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

### Option A: PostgreSQL (Recommended)
*   **Type**: Relational (SQL).
*   **Pros**: Robust, excellent JSONB support for flexible data, strong ecosystem, standard for Node.js services.
*   **Cons**: Requires running another container.
*   **Verdict**: Best choice for structured user/workout data mixed with JSON metrics.

### Option B: SQLite
*   **Type**: Embedded SQL.
*   **Pros**: Zero configuration, single file, no extra container needed.
*   **Cons**: Harder to manage backups/migrations in a containerized environment; concurrency limits.
*   **Verdict**: Good for simple self-hosted instances, but Postgres is better for a "service" architecture.

### Option C: MongoDB
*   **Type**: Document (NoSQL).
*   **Pros**: Native JSON storage, flexible schema.
*   **Cons**: Weaker support for relationships (Users <-> Workouts) compared to SQL.

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
1.  Install dependencies: `npm install prisma @prisma/client`.
2.  Initialize Prisma: `npx prisma init`.
3.  Define schema.
4.  Update `docker-compose.yml`.
5.  Refactor `server.js` to write to DB alongside Redis operations.
