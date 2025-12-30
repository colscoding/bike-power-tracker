# SQLite Implementation Guide

This guide provides detailed implementation steps for using SQLite with the Bike Power Tracker service, ideal for self-hosted and single-user deployments.

## Table of Contents

1. [Overview](#overview)
2. [When to Use SQLite](#when-to-use-sqlite)
3. [Setup](#setup)
4. [Schema Design](#schema-design)
5. [Database Service Layer](#database-service-layer)
6. [Server Integration](#server-integration)
7. [Performance Considerations](#performance-considerations)
8. [Backup & Recovery](#backup--recovery)
9. [Migration to PostgreSQL](#migration-to-postgresql)

---

## Overview

SQLite is an embedded database that stores everything in a single file. It's perfect for:
- Single-user deployments
- Home server / Raspberry Pi setups
- Development and testing
- Simple self-hosted instances

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Service                                 │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │ Express │────▶│   Prisma     │────▶│   SQLite File       │  │
│  │  API    │     │   Client     │     │   ./data/app.db     │  │
│  └─────────┘     └──────────────┘     └─────────────────────┘  │
│       │                                                         │
│       │          ┌──────────────┐     ┌─────────────────────┐  │
│       └─────────▶│    Redis     │────▶│   Redis Streams     │  │
│                  │   Client     │     │   (Real-time)       │  │
│                  └──────────────┘     └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- Zero configuration
- Single file database
- No separate server process
- ACID compliant
- Up to 281 TB database size (theoretical)

---

## When to Use SQLite

### ✅ Good For

| Scenario | Why SQLite Works |
|----------|------------------|
| Single user | No concurrent write conflicts |
| Home server | Simple deployment, no extra containers |
| Raspberry Pi | Low resource usage |
| Development | Fast setup, easy reset |
| Offline-first apps | Portable database file |

### ❌ Not Recommended For

| Scenario | Why Not |
|----------|---------|
| Multiple concurrent users | Write lock contention |
| High-traffic APIs | Limited write throughput |
| Distributed systems | Single file, no replication |
| Large datasets (>10GB) | Better options exist |

---

## Setup

### Installation

```bash
cd packages/service

# Install Prisma with SQLite support
npm install prisma @prisma/client

# Initialize Prisma
npx prisma init --datasource-provider sqlite
```

### Environment Configuration

Create or update `.env`:

```bash
# SQLite database path
DATABASE_URL="file:./data/biketracker.db"
```

### Docker Volume for Data Persistence

Update `docker-compose.home.yml`:

```yaml
version: '3.8'

services:
  redis:
    # ... existing config ...

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: bike_tracker_service
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - DATABASE_URL=file:/app/data/biketracker.db
    volumes:
      # Persist SQLite database outside container
      - sqlite_data:/app/data
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - backend
    restart: unless-stopped

volumes:
  redis_data:
  sqlite_data:

networks:
  backend:
```

### Directory Setup

```bash
# Create data directory
mkdir -p packages/service/data

# Add to .gitignore
echo "data/*.db" >> packages/service/.gitignore
echo "data/*.db-journal" >> packages/service/.gitignore
echo "data/*.db-wal" >> packages/service/.gitignore
echo "data/*.db-shm" >> packages/service/.gitignore
```

---

## Schema Design

Create `packages/service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String?   @map("password_hash")
  
  // OAuth support
  provider      String?
  providerId    String?   @map("provider_id")
  
  // Profile
  displayName   String?   @map("display_name")
  avatarUrl     String?   @map("avatar_url")
  
  // Settings stored as JSON string
  settings      String    @default("{}")
  
  // Timestamps
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  lastLoginAt   DateTime? @map("last_login_at")
  
  // Relations
  workouts      Workout[]
  apiKeys       ApiKey[]
  
  @@map("users")
  @@index([provider, providerId])
}

model ApiKey {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  keyHash     String    @map("key_hash")
  name        String
  
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
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Stream reference (for active workouts)
  streamName  String?   @map("stream_name")
  
  // Metadata
  title       String?
  description String?
  sport       String    @default("cycling")
  
  // Timing
  startTime   DateTime  @map("start_time")
  endTime     DateTime? @map("end_time")
  duration    Int?      // Duration in seconds
  
  // Status: ACTIVE, PAUSED, COMPLETED, ARCHIVED, DELETED
  status      String    @default("ACTIVE")
  
  // Summary metrics (JSON string)
  summary     String?
  
  // Archived telemetry data (JSON string, potentially large)
  telemetry   String?
  
  // Timestamps
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  @@map("workouts")
  @@index([userId])
  @@index([userId, startTime])
  @@index([status])
}

// ============================================
// PERSONAL RECORDS
// ============================================

model PersonalRecord {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  workoutId   String    @map("workout_id")
  
  metric      String    // "power", "heartrate", "speed"
  duration    Int       // Duration in seconds
  value       Float
  achievedAt  DateTime  @map("achieved_at")
  
  createdAt   DateTime  @default(now()) @map("created_at")
  
  @@map("personal_records")
  @@unique([userId, metric, duration])
  @@index([userId])
}
```

### Generate and Migrate

```bash
# Generate Prisma Client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init

# View database with Prisma Studio
npx prisma studio
```

---

## Database Service Layer

Create `packages/service/src/db/index.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

let prisma;

function getPrismaClient() {
  if (!prisma) {
    // Ensure data directory exists
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/biketracker.db';
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
    
    // Enable WAL mode for better concurrency
    prisma.$executeRaw`PRAGMA journal_mode = WAL`;
    prisma.$executeRaw`PRAGMA busy_timeout = 5000`;
    prisma.$executeRaw`PRAGMA synchronous = NORMAL`;
    prisma.$executeRaw`PRAGMA cache_size = -64000`; // 64MB cache
    prisma.$executeRaw`PRAGMA foreign_keys = ON`;
  }
  return prisma;
}

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
  const duration = Math.floor((endTime - new Date(workout.startTime)) / 1000);
  
  return prisma.workout.update({
    where: { id: workoutId },
    data: {
      endTime,
      duration,
      status: 'COMPLETED',
      // SQLite stores JSON as strings
      summary: summary ? JSON.stringify(summary) : null,
      telemetry: telemetry ? JSON.stringify(telemetry) : null,
      streamName: null,
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
      },
    }),
    prisma.workout.count({ where }),
  ]);
  
  // Parse JSON strings back to objects
  const parsedWorkouts = workouts.map(w => ({
    ...w,
    summary: w.summary ? JSON.parse(w.summary) : null,
  }));
  
  return {
    workouts: parsedWorkouts,
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
  
  const workout = await prisma.workout.findUnique({
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
  
  if (!workout) return null;
  
  return {
    ...workout,
    summary: workout.summary ? JSON.parse(workout.summary) : null,
    telemetry: workout.telemetry ? JSON.parse(workout.telemetry) : null,
  };
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
 * Calculate summary statistics from telemetry data
 */
function calculateSummary(telemetryData) {
  if (!telemetryData || !Array.isArray(telemetryData)) {
    return null;
  }
  
  const powerValues = [];
  const cadenceValues = [];
  const heartrateValues = [];
  
  for (const point of telemetryData) {
    if (point.power !== undefined && point.power > 0) powerValues.push(point.power);
    if (point.cadence !== undefined && point.cadence > 0) cadenceValues.push(point.cadence);
    if (point.heartrate !== undefined && point.heartrate > 0) heartrateValues.push(point.heartrate);
  }
  
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const max = (arr) => arr.length ? Math.max(...arr) : null;
  
  return {
    avgPower: avg(powerValues) ? Math.round(avg(powerValues)) : null,
    maxPower: max(powerValues),
    avgCadence: avg(cadenceValues) ? Math.round(avg(cadenceValues)) : null,
    maxCadence: max(cadenceValues),
    avgHeartrate: avg(heartrateValues) ? Math.round(avg(heartrateValues)) : null,
    maxHeartrate: max(heartrateValues),
    totalEnergy: powerValues.length > 0 
      ? Math.round(powerValues.reduce((a, b) => a + b, 0) / 1000) 
      : null, // kJ
    sampleCount: telemetryData.length,
  };
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

---

## Server Integration

Add database endpoints to `packages/service/src/server.js`:

```javascript
// Add imports
const { getPrismaClient, disconnectPrisma } = require('./db');
const workoutService = require('./db/workoutService');

// Initialize database
const prisma = getPrismaClient();

// ============================================
// WORKOUT ENDPOINTS
// ============================================

// Create a new workout
app.post('/api/workouts', authenticate, async (req, res) => {
  try {
    const { title, sport } = req.body;
    const userId = req.user?.id || 'default-user'; // Single user mode fallback
    
    // Generate stream name
    const streamName = `workout:${userId}:${Date.now()}`;
    
    // Create Redis stream for real-time data
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
    console.error('Error creating workout:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete a workout
app.post('/api/workouts/:workoutId/complete', authenticate, async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { archiveTelemetry = true } = req.body;
    
    const workout = await workoutService.getWorkout(workoutId);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    // Read telemetry from Redis stream
    let telemetryData = [];
    if (workout.streamName) {
      const messages = await redisClient.xRange(workout.streamName, '-', '+');
      telemetryData = messages
        .filter(m => m.message.message) // Filter out system messages
        .map(m => ({
          timestamp: parseInt(m.message.timestamp),
          ...JSON.parse(m.message.message),
        }));
    }
    
    // Calculate summary
    const summary = workoutService.calculateSummary(telemetryData);
    
    // Complete workout in database
    const completedWorkout = await workoutService.completeWorkout(workoutId, {
      summary,
      telemetry: archiveTelemetry ? telemetryData : null,
    });
    
    // Delete Redis stream
    if (workout.streamName) {
      await redisClient.del(workout.streamName);
    }
    
    res.json({
      success: true,
      workout: completedWorkout,
    });
  } catch (error) {
    console.error('Error completing workout:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workout history
app.get('/api/workouts', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || 'default-user';
    const { page = 1, limit = 20, status } = req.query;
    
    const result = await workoutService.getWorkoutHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching workouts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single workout
app.get('/api/workouts/:workoutId', authenticate, async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { includeTelemetry } = req.query;
    
    const workout = await workoutService.getWorkout(workoutId, {
      includeTelemetry: includeTelemetry === 'true',
    });
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    res.json({ workout });
  } catch (error) {
    console.error('Error fetching workout:', error);
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

## Performance Considerations

### WAL Mode (Critical)

Write-Ahead Logging significantly improves concurrent read/write performance:

```javascript
// Already configured in db/index.js
prisma.$executeRaw`PRAGMA journal_mode = WAL`;
```

**Benefits:**
- Readers don't block writers
- Writers don't block readers
- Better crash recovery
- Improved write performance

### Connection Settings

```javascript
// Recommended pragmas (set on connection)
PRAGMA busy_timeout = 5000;     // Wait 5s for locks
PRAGMA synchronous = NORMAL;    // Good balance of safety/speed
PRAGMA cache_size = -64000;     // 64MB page cache
PRAGMA temp_store = MEMORY;     // Temp tables in RAM
PRAGMA mmap_size = 268435456;   // 256MB memory-mapped I/O
```

### Handling Large Telemetry Data

For workouts with large telemetry, consider compression:

```javascript
const zlib = require('zlib');

// Compress before storing
function compressTelemetry(telemetry) {
  const json = JSON.stringify(telemetry);
  return zlib.gzipSync(json).toString('base64');
}

// Decompress when reading
function decompressTelemetry(compressed) {
  const buffer = Buffer.from(compressed, 'base64');
  const json = zlib.gunzipSync(buffer).toString();
  return JSON.parse(json);
}
```

### Query Optimization

```javascript
// Use raw queries for complex aggregations
async function getMonthlyStats(userId, year, month) {
  const prisma = getPrismaClient();
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const result = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as workout_count,
      SUM(duration) as total_duration,
      AVG(json_extract(summary, '$.avgPower')) as avg_power
    FROM workouts
    WHERE user_id = ${userId}
      AND start_time >= ${startDate.toISOString()}
      AND start_time <= ${endDate.toISOString()}
      AND status = 'COMPLETED'
  `;
  
  return result[0];
}
```

---

## Backup & Recovery

### Simple File Backup

```bash
#!/bin/bash
# backup-sqlite.sh

DATA_DIR="${DATA_DIR:-./data}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Use SQLite backup command for consistency
sqlite3 "$DATA_DIR/biketracker.db" ".backup '$BACKUP_DIR/biketracker-$TIMESTAMP.db'"

# Compress
gzip "$BACKUP_DIR/biketracker-$TIMESTAMP.db"

# Clean old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.db.gz" -mtime +7 -delete

echo "Backup completed: biketracker-$TIMESTAMP.db.gz"
```

### Docker Backup

```bash
# Backup from running container
docker exec bike_tracker_service sqlite3 /app/data/biketracker.db ".backup /tmp/backup.db"
docker cp bike_tracker_service:/tmp/backup.db ./backups/biketracker-$(date +%Y%m%d).db
```

### Automated Backup with Cron

```bash
# Add to crontab
0 2 * * * /path/to/backup-sqlite.sh >> /var/log/sqlite-backup.log 2>&1
```

### Restore

```bash
# Stop the service first
docker compose down

# Restore from backup
gunzip -c backups/biketracker-20250101.db.gz > data/biketracker.db

# Restart
docker compose up -d
```

---

## Migration to PostgreSQL

If you outgrow SQLite, here's how to migrate:

### 1. Export Data

```javascript
// scripts/export-sqlite.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function exportData() {
  const prisma = new PrismaClient();
  
  const users = await prisma.user.findMany({ include: { workouts: true } });
  
  fs.writeFileSync('export.json', JSON.stringify(users, null, 2));
  
  console.log(`Exported ${users.length} users`);
  await prisma.$disconnect();
}

exportData();
```

### 2. Update Schema

Change `datasource` in `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3. Import Data

```javascript
// scripts/import-postgres.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function importData() {
  const prisma = new PrismaClient();
  const data = JSON.parse(fs.readFileSync('export.json'));
  
  for (const user of data) {
    await prisma.user.create({
      data: {
        ...user,
        workouts: {
          create: user.workouts.map(w => ({
            ...w,
            summary: w.summary, // Already JSON in Postgres
            telemetry: w.telemetry,
          })),
        },
      },
    });
  }
  
  console.log('Import complete');
  await prisma.$disconnect();
}

importData();
```

---

## Troubleshooting

### Database Locked

```bash
# Check for WAL mode
sqlite3 data/biketracker.db "PRAGMA journal_mode"

# Force checkpoint
sqlite3 data/biketracker.db "PRAGMA wal_checkpoint(TRUNCATE)"
```

### Corruption Recovery

```bash
# Check integrity
sqlite3 data/biketracker.db "PRAGMA integrity_check"

# Attempt recovery
sqlite3 data/biketracker.db ".recover" | sqlite3 data/recovered.db
```

### Permission Issues

```bash
# Ensure proper ownership in Docker
chown -R 1001:1001 data/

# Or in docker-compose
user: "1001:1001"
```

### Database Too Large

```bash
# Check size
ls -lh data/biketracker.db

# Vacuum to reclaim space
sqlite3 data/biketracker.db "VACUUM"

# Consider archiving old workouts
```
