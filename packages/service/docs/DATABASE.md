# Database & Persistence

The service uses a hybrid approach for data management: **Prisma** for relational data and **Redis** for ephemeral/high-speed streams.

## Relational Database (Prisma)

The schema is defined in `prisma/schema.prisma`.

### Supported Providers
1.  **PostgreSQL** (Recommended for Production): Handles concurrent users and large datasets well.
2.  **SQLite** (Self-hosted / Dev): Simplifies deployment by storing data in a single file (`.db`).

### Key Models

#### `User`
Stores user credentials and profile information.
-   `email`: Unique identifier.
-   `passwordHash`: Bcrypt hashed password.
-   `settings`: JSON blob for user preferences.

#### `Workout`
Represents a recorded session.
-   `userId`: Owner of the workout.
-   `startTime` / `endTime`: Duration.
-   `data`: JSON blob containing summary metrics (avg power, total energy, etc.).

#### `ApiKey`
Allows programmatic access without session login.

### Migrations
-   Run `npx prisma migrate dev` to apply schema changes in development.
-   Run `npx prisma migrate deploy` in production.

## Redis (Streams & Caching)

Redis is used primarily for the **Event Bus**.

### Streams (`XADD`, `XREAD`)
Sensor data provided by the client is pushed to Redis Streams. This allows:
-   Decoupling of data producers (phones/browsers) and consumers (dashboards/analytics).
-   Replayability of recent sensor data.

### Keyspace Structure
-   `stream:{workoutId}`: Stream of sensor events for a specific live workout.
-   `cache:user:{id}`: Cached user profile (optional, if implemented).

## Connection Configuration
-   **Database**: Set `DATABASE_URL` env variable.
-   **Redis**: Set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
