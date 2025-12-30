# PostgreSQL Implementation Guide

This guide provides detailed implementation steps for adding PostgreSQL to the Bike Power Tracker service.

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Prisma ORM Setup](#prisma-orm-setup)
4. [Schema Design](#schema-design)
5. [Database Service Layer](#database-service-layer)
6. [Server Integration](#server-integration)
7. [Migrations](#migrations)
8. [Backup & Recovery](#backup--recovery)
9. [Performance Optimization](#performance-optimization)

---

## Overview

PostgreSQL is the recommended database for production deployments due to:
- Robust ACID compliance
- Excellent JSONB support for flexible telemetry storage
- Strong ecosystem and tooling
- Built-in full-text search
- Mature replication and backup solutions

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Service                                 │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │ Express │────▶│   Prisma     │────▶│    PostgreSQL       │  │
│  │  API    │     │   Client     │     │   (Persistent)      │  │
│  └─────────┘     └──────────────┘     └─────────────────────┘  │
│       │                                                         │
│       │          ┌──────────────┐     ┌─────────────────────┐  │
│       └─────────▶│    Redis     │────▶│   Redis Streams     │  │
│                  │   Client     │     │   (Real-time)       │  │
│                  └──────────────┘     └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Setup

### Docker Compose Configuration

Add PostgreSQL to `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Existing services...
  
  postgres:
    image: postgres:16-alpine
    container_name: bike_tracker_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-biketracker}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-biketracker}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-biketracker} -d ${POSTGRES_DB:-biketracker}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend
    restart: always
    deploy:
      resources:
        limits:
          memory: 512M

  app:
    # ... existing config
    environment:
      # ... existing env vars
      - DATABASE_URL=postgresql://${POSTGRES_USER:-biketracker}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-biketracker}?schema=public
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy

volumes:
  redis_data:
  postgres_data:

networks:
  backend:
```

### Environment Variables

Add to `.env`:

```bash
# PostgreSQL Configuration
POSTGRES_USER=biketracker
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_DB=biketracker
DATABASE_URL=postgresql://biketracker:your-secure-password-here@postgres:5432/biketracker?schema=public
```

### Database Initialization Script

Create `packages/service/init-db/01-init.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search (optional)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes tablespace for better I/O separation (optional, for production)
-- CREATE TABLESPACE indexes LOCATION '/var/lib/postgresql/indexes';
```

---

## Prisma ORM Setup

### Installation

```bash
cd packages/service
npm install prisma @prisma/client
npx prisma init
```

### Configuration

Create `packages/service/prisma/schema.prisma`:

```prisma
// This is your Prisma schema file

generator client {
  provider = "prisma-client-js"
  // Enable query logging in development
  // previewFeatures = ["tracing"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

model User {
  id            String    @id @default(uuid()) @db.Uuid
  email         String    @unique @db.VarChar(255)
  passwordHash  String?   @map("password_hash") @db.VarChar(255)
  
  // OAuth support
  provider      String?   @db.VarChar(50)  // "google", "strava", etc.
  providerId    String?   @map("provider_id") @db.VarChar(255)
  
  // Profile
  displayName   String?   @map("display_name") @db.VarChar(100)
  avatarUrl     String?   @map("avatar_url") @db.VarChar(500)
  
  // Settings stored as JSON
  settings      Json?     @default("{}")
  
  // Timestamps
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  lastLoginAt   DateTime? @map("last_login_at")
  
  // Relations
  workouts      Workout[]
  apiKeys       ApiKey[]
  
  @@map("users")
  @@index([email])
  @@index([provider, providerId])
}

model ApiKey {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  keyHash     String    @map("key_hash") @db.VarChar(255)
  name        String    @db.VarChar(100)
  
  lastUsedAt  DateTime? @map("last_used_at")
  expiresAt   DateTime? @map("expires_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  
  @@map("api_keys")
  @@index([keyHash])
}

// ============================================
// WORKOUT DATA
// ============================================

model Workout {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Stream reference (for active workouts)
  streamName  String?   @map("stream_name") @db.VarChar(255)
  
  // Metadata
  title       String?   @db.VarChar(200)
  description String?   @db.Text
  sport       String    @default("cycling") @db.VarChar(50)
  
  // Timing
  startTime   DateTime  @map("start_time")
  endTime     DateTime? @map("end_time")
  duration    Int?      // Duration in seconds
  
  // Status
  status      WorkoutStatus @default(ACTIVE)
  
  // Summary metrics (calculated on completion)
  summary     Json?
  
  // Archived telemetry data (moved from Redis on completion)
  // Stored as compressed JSONB
  telemetry   Json?
  
  // Timestamps
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  @@map("workouts")
  @@index([userId])
  @@index([userId, startTime(sort: Desc)])
  @@index([status])
  @@index([startTime])
}

enum WorkoutStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
  DELETED
}

// ============================================
// ANALYTICS & RECORDS
// ============================================

model PersonalRecord {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  workoutId   String    @map("workout_id") @db.Uuid
  
  // Record type and duration
  metric      String    @db.VarChar(50)  // "power", "heartrate", "speed"
  duration    Int       // Duration in seconds (e.g., 60 for 1-min power)
  
  // Record value
  value       Float
  
  // When achieved
  achievedAt  DateTime  @map("achieved_at")
  
  createdAt   DateTime  @default(now()) @map("created_at")
  
  @@map("personal_records")
  @@unique([userId, metric, duration])
  @@index([userId])
}
```

### Generate Client

```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name init

# In production
npx prisma migrate deploy
```

---

## Database Service Layer

Create `packages/service/src/db/index.js`:

```javascript
const { PrismaClient } = require('@prisma/client');

// Singleton pattern for Prisma Client
let prisma;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }
  return prisma;
}

// Graceful shutdown
async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

module.exports = {
  getPrismaClient,
  disconnectPrisma,
};
```

Create `packages/service/src/db/workoutService.js`:

```javascript
const { getPrismaClient } = require('./index');

/**
 * Create a new workout record
 */
async function createWorkout({ userId, streamName, title, sport = 'cycling' }) {
  const prisma = getPrismaClient();
  
  return prisma.workout.create({
    data: {
      userId,
      streamName,
      title,
      sport,
      startTime: new Date(),
      status: 'ACTIVE',
    },
  });
}

/**
 * Complete a workout with summary statistics
 */
async function completeWorkout(workoutId, { summary, telemetry }) {
  const prisma = getPrismaClient();
  
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
  });
  
  if (!workout) {
    throw new Error('Workout not found');
  }
  
  const endTime = new Date();
  const duration = Math.floor((endTime - workout.startTime) / 1000);
  
  return prisma.workout.update({
    where: { id: workoutId },
    data: {
      endTime,
      duration,
      status: 'COMPLETED',
      summary,
      telemetry,
      streamName: null, // Clear stream reference
    },
  });
}

/**
 * Get user's workout history
 */
async function getWorkoutHistory(userId, { page = 1, limit = 20, status } = {}) {
  const prisma = getPrismaClient();
  
  const where = { userId };
  if (status) {
    where.status = status;
  }
  
  const [workouts, total] = await Promise.all([
    prisma.workout.findMany({
      where,
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        sport: true,
        startTime: true,
        endTime: true,
        duration: true,
        status: true,
        summary: true,
        // Exclude telemetry for list view (too large)
      },
    }),
    prisma.workout.count({ where }),
  ]);
  
  return {
    workouts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single workout with full data
 */
async function getWorkout(workoutId, { includeTelemetry = false } = {}) {
  const prisma = getPrismaClient();
  
  return prisma.workout.findUnique({
    where: { id: workoutId },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      sport: true,
      startTime: true,
      endTime: true,
      duration: true,
      status: true,
      summary: true,
      telemetry: includeTelemetry,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Get active workout by stream name
 */
async function getActiveWorkoutByStream(streamName) {
  const prisma = getPrismaClient();
  
  return prisma.workout.findFirst({
    where: {
      streamName,
      status: 'ACTIVE',
    },
  });
}

/**
 * Calculate and store summary statistics
 */
function calculateSummary(telemetryData) {
  if (!telemetryData || !Array.isArray(telemetryData)) {
    return null;
  }
  
  const powerValues = [];
  const cadenceValues = [];
  const heartrateValues = [];
  
  for (const point of telemetryData) {
    if (point.power !== undefined) powerValues.push(point.power);
    if (point.cadence !== undefined) cadenceValues.push(point.cadence);
    if (point.heartrate !== undefined) heartrateValues.push(point.heartrate);
  }
  
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const max = (arr) => arr.length ? Math.max(...arr) : null;
  
  return {
    // Power metrics
    avgPower: avg(powerValues) ? Math.round(avg(powerValues)) : null,
    maxPower: max(powerValues),
    normalizedPower: calculateNormalizedPower(powerValues),
    
    // Cadence metrics
    avgCadence: avg(cadenceValues) ? Math.round(avg(cadenceValues)) : null,
    maxCadence: max(cadenceValues),
    
    // Heart rate metrics
    avgHeartrate: avg(heartrateValues) ? Math.round(avg(heartrateValues)) : null,
    maxHeartrate: max(heartrateValues),
    
    // Energy
    totalEnergy: calculateTotalEnergy(powerValues), // kJ
    
    // Sample count
    sampleCount: telemetryData.length,
  };
}

/**
 * Calculate Normalized Power (NP)
 * Uses 30-second rolling average raised to 4th power
 */
function calculateNormalizedPower(powerValues, sampleRate = 1) {
  if (powerValues.length < 30 / sampleRate) return null;
  
  const windowSize = Math.round(30 / sampleRate);
  const rollingAvg = [];
  
  for (let i = windowSize - 1; i < powerValues.length; i++) {
    const window = powerValues.slice(i - windowSize + 1, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    rollingAvg.push(Math.pow(avg, 4));
  }
  
  const avgFourthPower = rollingAvg.reduce((a, b) => a + b, 0) / rollingAvg.length;
  return Math.round(Math.pow(avgFourthPower, 0.25));
}

/**
 * Calculate total energy expenditure in kJ
 */
function calculateTotalEnergy(powerValues, sampleRate = 1) {
  if (!powerValues.length) return null;
  
  // Energy = Power × Time, convert to kJ
  const totalJoules = powerValues.reduce((sum, power) => sum + (power * sampleRate), 0);
  return Math.round(totalJoules / 1000);
}

module.exports = {
  createWorkout,
  completeWorkout,
  getWorkoutHistory,
  getWorkout,
  getActiveWorkoutByStream,
  calculateSummary,
};
```

Create `packages/service/src/db/userService.js`:

```javascript
const { getPrismaClient } = require('./index');
const crypto = require('crypto');

/**
 * Create a new user
 */
async function createUser({ email, passwordHash, displayName, provider, providerId }) {
  const prisma = getPrismaClient();
  
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      provider,
      providerId,
    },
  });
}

/**
 * Find user by email
 */
async function findUserByEmail(email) {
  const prisma = getPrismaClient();
  
  return prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Find user by OAuth provider
 */
async function findUserByProvider(provider, providerId) {
  const prisma = getPrismaClient();
  
  return prisma.user.findFirst({
    where: { provider, providerId },
  });
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(userId) {
  const prisma = getPrismaClient();
  
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Create API key for user
 */
async function createApiKey(userId, name) {
  const prisma = getPrismaClient();
  
  // Generate random API key
  const rawKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
    },
  });
  
  // Return raw key only once (store hash in DB)
  return rawKey;
}

/**
 * Validate API key and return user
 */
async function validateApiKey(rawKey) {
  const prisma = getPrismaClient();
  
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { user: true },
  });
  
  if (apiKey) {
    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
    
    return apiKey.user;
  }
  
  return null;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserByProvider,
  updateLastLogin,
  createApiKey,
  validateApiKey,
};
```

---

## Server Integration

Update `packages/service/src/server.js` to use the database:

```javascript
// Add to existing imports
const { getPrismaClient, disconnectPrisma } = require('./db');
const workoutService = require('./db/workoutService');
const userService = require('./db/userService');

// Initialize Prisma alongside Redis
const prisma = getPrismaClient();

// New endpoint: Create workout with DB record
app.post('/api/workouts', authenticate, async (req, res) => {
  try {
    const { title, sport } = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Generate stream name
    const streamName = `workout:${userId}:${Date.now()}`;
    
    // Create Redis stream
    await redisClient.xAdd(streamName, '*', {
      type: 'workout_started',
      timestamp: Date.now().toString(),
    });
    
    // Create database record
    const workout = await workoutService.createWorkout({
      userId,
      streamName,
      title,
      sport,
    });
    
    res.json({
      success: true,
      workout: {
        id: workout.id,
        streamName: workout.streamName,
        title: workout.title,
        startTime: workout.startTime,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Complete workout
app.post('/api/workouts/:workoutId/complete', authenticate, async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { archiveTelemetry = true } = req.body;
    
    // Get workout record
    const workout = await workoutService.getWorkout(workoutId);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    // Read all data from Redis stream
    let telemetryData = [];
    if (workout.streamName) {
      const messages = await redisClient.xRange(workout.streamName, '-', '+');
      telemetryData = messages
        .filter(m => m.message.type !== 'stream_created' && m.message.type !== 'workout_started')
        .map(m => ({
          timestamp: parseInt(m.message.timestamp),
          ...JSON.parse(m.message.message || '{}'),
        }));
    }
    
    // Calculate summary
    const summary = workoutService.calculateSummary(telemetryData);
    
    // Complete workout in database
    const completedWorkout = await workoutService.completeWorkout(workoutId, {
      summary,
      telemetry: archiveTelemetry ? telemetryData : null,
    });
    
    // Delete Redis stream (data now in Postgres)
    if (workout.streamName) {
      await redisClient.del(workout.streamName);
    }
    
    res.json({
      success: true,
      workout: completedWorkout,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Get workout history
app.get('/api/workouts', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, status } = req.query;
    
    const result = await workoutService.getWorkoutHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Get single workout
app.get('/api/workouts/:workoutId', authenticate, async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { includeTelemetry = false } = req.query;
    
    const workout = await workoutService.getWorkout(workoutId, {
      includeTelemetry: includeTelemetry === 'true',
    });
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    res.json({ workout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await disconnectPrisma();
  await redisClient.quit();
  process.exit(0);
});
```

---

## Migrations

### Development Workflow

```bash
# Create a new migration
npx prisma migrate dev --name add_feature_x

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

### Production Deployment

```bash
# Apply pending migrations
npx prisma migrate deploy

# Or in Docker
docker exec bike_tracker_service npx prisma migrate deploy
```

### Dockerfile Update

Update `packages/service/Dockerfile`:

```dockerfile
# ... existing stages ...

FROM node:18-alpine AS production

# ... existing setup ...

# Copy Prisma schema and migrations
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# ... rest of Dockerfile ...

# Start command should run migrations first
CMD ["sh", "-c", "npx prisma migrate deploy && dumb-init node src/server.js"]
```

---

## Backup & Recovery

### Automated Backups

Create `packages/service/scripts/backup-postgres.sh`:

```bash
#!/bin/bash

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create backup
docker exec bike_tracker_postgres pg_dump \
  -U "${POSTGRES_USER:-biketracker}" \
  -d "${POSTGRES_DB:-biketracker}" \
  --format=custom \
  --compress=9 \
  > "${BACKUP_DIR}/postgres-${TIMESTAMP}.dump"

# Clean old backups
find "${BACKUP_DIR}" -name "postgres-*.dump" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: postgres-${TIMESTAMP}.dump"
```

### Restore from Backup

```bash
# Restore from custom format dump
docker exec -i bike_tracker_postgres pg_restore \
  -U biketracker \
  -d biketracker \
  --clean \
  --if-exists \
  < /backups/postgres-20250101-120000.dump
```

### Point-in-Time Recovery (Advanced)

For critical deployments, enable WAL archiving in `postgresql.conf`:

```
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'
```

---

## Performance Optimization

### Connection Pooling

For high-traffic scenarios, use PgBouncer:

```yaml
# Add to docker-compose
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    - DATABASE_URL=postgres://biketracker:password@postgres:5432/biketracker
    - POOL_MODE=transaction
    - MAX_CLIENT_CONN=100
    - DEFAULT_POOL_SIZE=20
  depends_on:
    - postgres
  networks:
    - backend
```

### Indexes

The schema includes essential indexes. Monitor slow queries and add more as needed:

```sql
-- Find slow queries
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Add index for common queries
CREATE INDEX CONCURRENTLY idx_workouts_user_status 
ON workouts(user_id, status) 
WHERE status = 'COMPLETED';
```

### JSON Optimization

Use JSONB operators for efficient querying:

```sql
-- Query summary data efficiently
SELECT id, title, summary->>'avgPower' as avg_power
FROM workouts
WHERE summary->>'avgPower' IS NOT NULL
  AND (summary->>'avgPower')::int > 200;

-- Add GIN index for JSON queries
CREATE INDEX idx_workouts_summary ON workouts USING GIN (summary);
```

### Vacuum and Analyze

```bash
# Run maintenance
docker exec bike_tracker_postgres vacuumdb -U biketracker -d biketracker --analyze
```

---

## Troubleshooting

### Connection Issues

```bash
# Check PostgreSQL logs
docker logs bike_tracker_postgres

# Test connection
docker exec bike_tracker_postgres psql -U biketracker -d biketracker -c "SELECT 1"

# Check connection from app container
docker exec bike_tracker_service node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.\$connect().then(() => console.log('Connected!')).catch(console.error);
"
```

### Migration Failures

```bash
# Check migration status
npx prisma migrate status

# Reset if needed (development only)
npx prisma migrate reset

# Manual SQL if needed
docker exec -it bike_tracker_postgres psql -U biketracker -d biketracker
```

### Performance Issues

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'biketracker';

# Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```
