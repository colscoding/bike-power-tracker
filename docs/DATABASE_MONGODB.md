# MongoDB Implementation Guide

This guide provides detailed implementation steps for using MongoDB with the Bike Power Tracker service, suitable for flexible schema requirements and document-oriented data.

## Table of Contents

1. [Overview](#overview)
2. [When to Use MongoDB](#when-to-use-mongodb)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Schema Design](#schema-design)
5. [Database Service Layer](#database-service-layer)
6. [Server Integration](#server-integration)
7. [Indexing Strategy](#indexing-strategy)
8. [Aggregation Pipelines](#aggregation-pipelines)
9. [Backup & Recovery](#backup--recovery)
10. [Performance Optimization](#performance-optimization)

---

## Overview

MongoDB is a document database that stores data in flexible, JSON-like documents. It's well-suited for:
- Flexible, evolving schemas
- Embedded telemetry data
- Complex aggregation queries
- Horizontal scaling (future)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Service                                 │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │ Express │────▶│   Mongoose   │────▶│     MongoDB         │  │
│  │  API    │     │   ODM        │     │   (Persistent)      │  │
│  └─────────┘     └──────────────┘     └─────────────────────┘  │
│       │                                                         │
│       │          ┌──────────────┐     ┌─────────────────────┐  │
│       └─────────▶│    Redis     │────▶│   Redis Streams     │  │
│                  │   Client     │     │   (Real-time)       │  │
│                  └──────────────┘     └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- Schema-less / flexible schema
- Native JSON storage
- Rich query language
- Built-in aggregation framework
- Horizontal scaling with sharding

---

## When to Use MongoDB

### ✅ Good For

| Scenario | Why MongoDB Works |
|----------|-------------------|
| Flexible telemetry formats | Schema-less design |
| Embedded workout data | Document model fits naturally |
| Complex analytics | Aggregation pipeline |
| Rapid prototyping | No migrations needed |
| Time-series data | Native time-series collections |

### ⚠️ Considerations

| Aspect | Note |
|--------|------|
| ACID transactions | Supported but with caveats |
| Joins | Less efficient than SQL |
| Storage efficiency | JSON overhead vs binary formats |
| Memory usage | Higher than PostgreSQL for same data |

---

## Infrastructure Setup

### Docker Compose Configuration

Add MongoDB to `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Existing services...

  mongodb:
    image: mongo:7
    container_name: bike_tracker_mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:-biketracker}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: ${MONGO_DB:-biketracker}
    volumes:
      - mongo_data:/data/db
      - ./init-mongo:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
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
    command: ["--wiredTigerCacheSizeGB", "0.25"]

  app:
    # ... existing config
    environment:
      # ... existing env vars
      - MONGODB_URI=mongodb://${MONGO_USER:-biketracker}:${MONGO_PASSWORD}@mongodb:27017/${MONGO_DB:-biketracker}?authSource=admin
    depends_on:
      redis:
        condition: service_healthy
      mongodb:
        condition: service_healthy

volumes:
  redis_data:
  mongo_data:

networks:
  backend:
```

### Environment Variables

Add to `.env`:

```bash
# MongoDB Configuration
MONGO_USER=biketracker
MONGO_PASSWORD=your-secure-password-here
MONGO_DB=biketracker
MONGODB_URI=mongodb://biketracker:your-secure-password-here@mongodb:27017/biketracker?authSource=admin
```

### Database Initialization Script

Create `packages/service/init-mongo/01-init.js`:

```javascript
// This script runs on first container start
db = db.getSiblingDB('biketracker');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          description: 'User email - required'
        },
        displayName: {
          bsonType: 'string'
        },
        createdAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('workouts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'startTime', 'status'],
      properties: {
        userId: {
          bsonType: 'objectId'
        },
        status: {
          enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED']
        }
      }
    }
  }
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ 'oauth.provider': 1, 'oauth.providerId': 1 });

db.workouts.createIndex({ userId: 1, startTime: -1 });
db.workouts.createIndex({ status: 1 });
db.workouts.createIndex({ streamName: 1 }, { sparse: true });

print('Database initialized successfully');
```

---

## Schema Design

### Installation

```bash
cd packages/service
npm install mongoose
```

### Models

Create `packages/service/src/db/models/User.js`:

```javascript
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    select: false, // Don't include by default in queries
  },
  
  // OAuth integration
  oauth: {
    provider: String, // 'google', 'strava', etc.
    providerId: String,
    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
  },
  
  // Profile
  displayName: String,
  avatarUrl: String,
  
  // User preferences
  settings: {
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    ftp: Number, // Functional Threshold Power
    maxHr: Number,
    weight: Number, // kg
    timezone: { type: String, default: 'UTC' },
  },
  
  // API keys for programmatic access
  apiKeys: [{
    keyHash: { type: String, required: true },
    name: { type: String, required: true },
    lastUsedAt: Date,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now },
  }],
  
  lastLoginAt: Date,
}, {
  timestamps: true, // Adds createdAt, updatedAt
});

// Compound index for OAuth lookups
userSchema.index({ 'oauth.provider': 1, 'oauth.providerId': 1 });

// Instance methods
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    settings: this.settings,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
```

Create `packages/service/src/db/models/Workout.js`:

```javascript
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for telemetry data points
const telemetryPointSchema = new Schema({
  timestamp: { type: Number, required: true }, // Unix ms
  power: Number,
  cadence: Number,
  heartrate: Number,
  speed: Number,
  distance: Number,
  altitude: Number,
  temperature: Number,
  lat: Number,
  lng: Number,
}, { _id: false });

// Sub-schema for summary statistics
const summarySchema = new Schema({
  // Power metrics
  avgPower: Number,
  maxPower: Number,
  normalizedPower: Number,
  intensityFactor: Number,
  trainingStressScore: Number,
  
  // Cadence metrics
  avgCadence: Number,
  maxCadence: Number,
  
  // Heart rate metrics  
  avgHeartrate: Number,
  maxHeartrate: Number,
  
  // Speed/Distance
  avgSpeed: Number,
  maxSpeed: Number,
  totalDistance: Number, // meters
  
  // Elevation
  totalAscent: Number,
  totalDescent: Number,
  
  // Energy
  totalEnergy: Number, // kJ
  
  // Counts
  sampleCount: Number,
}, { _id: false });

const workoutSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Stream reference for active workouts
  streamName: {
    type: String,
    sparse: true,
    index: true,
  },
  
  // Metadata
  title: String,
  description: String,
  sport: {
    type: String,
    enum: ['cycling', 'running', 'swimming', 'other'],
    default: 'cycling',
  },
  
  // Timing
  startTime: {
    type: Date,
    required: true,
    index: true,
  },
  endTime: Date,
  duration: Number, // seconds
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED'],
    default: 'ACTIVE',
    index: true,
  },
  
  // Summary statistics
  summary: summarySchema,
  
  // Full telemetry data (embedded for completed workouts)
  telemetry: [telemetryPointSchema],
  
  // Personal records achieved in this workout
  personalRecords: [{
    metric: String,
    duration: Number, // seconds
    value: Number,
  }],
  
  // Tags for organization
  tags: [String],
  
  // Equipment used
  equipment: [{
    type: String, // 'bike', 'powermeter', 'heartrate'
    name: String,
    id: String,
  }],
}, {
  timestamps: true,
});

// Compound indexes for common queries
workoutSchema.index({ userId: 1, startTime: -1 });
workoutSchema.index({ userId: 1, status: 1 });
workoutSchema.index({ userId: 1, 'summary.avgPower': -1 });

// Virtual for duration calculation
workoutSchema.virtual('calculatedDuration').get(function() {
  if (this.duration) return this.duration;
  if (this.endTime && this.startTime) {
    return Math.floor((this.endTime - this.startTime) / 1000);
  }
  return null;
});

// Pre-save hook to calculate duration
workoutSchema.pre('save', function(next) {
  if (this.endTime && this.startTime && !this.duration) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

// Instance method for JSON output
workoutSchema.methods.toListJSON = function() {
  return {
    id: this._id,
    title: this.title,
    sport: this.sport,
    startTime: this.startTime,
    endTime: this.endTime,
    duration: this.duration,
    status: this.status,
    summary: this.summary,
    tags: this.tags,
  };
};

// Static method for time-based queries
workoutSchema.statics.findByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    startTime: { $gte: startDate, $lte: endDate },
    status: 'COMPLETED',
  }).sort({ startTime: -1 });
};

module.exports = mongoose.model('Workout', workoutSchema);
```

Create `packages/service/src/db/models/PersonalRecord.js`:

```javascript
const mongoose = require('mongoose');
const { Schema } = mongoose;

const personalRecordSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  workoutId: {
    type: Schema.Types.ObjectId,
    ref: 'Workout',
    required: true,
  },
  
  metric: {
    type: String,
    required: true,
    enum: ['power', 'heartrate', 'speed', 'cadence'],
  },
  duration: {
    type: Number,
    required: true, // seconds (e.g., 60 for 1-min power)
  },
  value: {
    type: Number,
    required: true,
  },
  
  achievedAt: {
    type: Date,
    required: true,
  },
  
  // Previous record (for history)
  previousValue: Number,
  improvement: Number, // percentage or absolute
}, {
  timestamps: true,
});

// Compound unique index
personalRecordSchema.index({ userId: 1, metric: 1, duration: 1 }, { unique: true });

module.exports = mongoose.model('PersonalRecord', personalRecordSchema);
```

---

## Database Service Layer

Create `packages/service/src/db/index.js`:

```javascript
const mongoose = require('mongoose');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/biketracker';
  
  mongoose.set('strictQuery', true);
  
  // Connection options
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };
  
  try {
    await mongoose.connect(uri, options);
    isConnected = true;
    console.log('Connected to MongoDB');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

// Health check
async function checkConnection() {
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  checkConnection,
  mongoose,
};
```

Create `packages/service/src/db/workoutService.js`:

```javascript
const Workout = require('./models/Workout');
const PersonalRecord = require('./models/PersonalRecord');

/**
 * Create a new workout
 */
async function createWorkout({ userId, streamName, title, sport = 'cycling' }) {
  const workout = new Workout({
    userId,
    streamName,
    title,
    sport,
    startTime: new Date(),
    status: 'ACTIVE',
  });
  
  await workout.save();
  return workout;
}

/**
 * Complete a workout with summary and telemetry
 */
async function completeWorkout(workoutId, { summary, telemetry }) {
  const workout = await Workout.findById(workoutId);
  
  if (!workout) {
    throw new Error('Workout not found');
  }
  
  workout.endTime = new Date();
  workout.duration = Math.floor((workout.endTime - workout.startTime) / 1000);
  workout.status = 'COMPLETED';
  workout.summary = summary;
  workout.telemetry = telemetry || [];
  workout.streamName = undefined; // Clear stream reference
  
  // Check for personal records
  const records = await checkPersonalRecords(workout.userId, workout);
  workout.personalRecords = records;
  
  await workout.save();
  return workout;
}

/**
 * Get user's workout history with pagination
 */
async function getWorkoutHistory(userId, { page = 1, limit = 20, status, sport } = {}) {
  const query = { userId };
  
  if (status) query.status = status;
  if (sport) query.sport = sport;
  
  const [workouts, total] = await Promise.all([
    Workout.find(query)
      .select('-telemetry') // Exclude large telemetry array
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Workout.countDocuments(query),
  ]);
  
  return {
    workouts: workouts.map(w => ({
      id: w._id,
      title: w.title,
      sport: w.sport,
      startTime: w.startTime,
      endTime: w.endTime,
      duration: w.duration,
      status: w.status,
      summary: w.summary,
      tags: w.tags,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get single workout with optional telemetry
 */
async function getWorkout(workoutId, { includeTelemetry = false } = {}) {
  const projection = includeTelemetry ? {} : { telemetry: 0 };
  
  const workout = await Workout.findById(workoutId, projection).lean();
  
  if (!workout) return null;
  
  return {
    id: workout._id,
    userId: workout.userId,
    title: workout.title,
    description: workout.description,
    sport: workout.sport,
    startTime: workout.startTime,
    endTime: workout.endTime,
    duration: workout.duration,
    status: workout.status,
    summary: workout.summary,
    telemetry: workout.telemetry,
    personalRecords: workout.personalRecords,
    tags: workout.tags,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
  };
}

/**
 * Get active workout by stream name
 */
async function getActiveWorkoutByStream(streamName) {
  return Workout.findOne({ streamName, status: 'ACTIVE' });
}

/**
 * Calculate summary statistics from telemetry
 */
function calculateSummary(telemetryData) {
  if (!telemetryData || !Array.isArray(telemetryData) || telemetryData.length === 0) {
    return null;
  }
  
  const metrics = {
    power: [],
    cadence: [],
    heartrate: [],
    speed: [],
  };
  
  for (const point of telemetryData) {
    if (point.power > 0) metrics.power.push(point.power);
    if (point.cadence > 0) metrics.cadence.push(point.cadence);
    if (point.heartrate > 0) metrics.heartrate.push(point.heartrate);
    if (point.speed > 0) metrics.speed.push(point.speed);
  }
  
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const max = (arr) => arr.length ? Math.max(...arr) : null;
  
  return {
    avgPower: avg(metrics.power) ? Math.round(avg(metrics.power)) : null,
    maxPower: max(metrics.power),
    normalizedPower: calculateNormalizedPower(metrics.power),
    
    avgCadence: avg(metrics.cadence) ? Math.round(avg(metrics.cadence)) : null,
    maxCadence: max(metrics.cadence),
    
    avgHeartrate: avg(metrics.heartrate) ? Math.round(avg(metrics.heartrate)) : null,
    maxHeartrate: max(metrics.heartrate),
    
    avgSpeed: avg(metrics.speed) ? Math.round(avg(metrics.speed) * 10) / 10 : null,
    maxSpeed: max(metrics.speed),
    
    totalEnergy: metrics.power.length > 0 
      ? Math.round(metrics.power.reduce((a, b) => a + b, 0) / 1000)
      : null,
    
    sampleCount: telemetryData.length,
  };
}

/**
 * Calculate Normalized Power
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
 * Check and update personal records
 */
async function checkPersonalRecords(userId, workout) {
  const durations = [5, 10, 30, 60, 300, 600, 1200, 3600]; // seconds
  const records = [];
  
  if (!workout.telemetry || workout.telemetry.length === 0) {
    return records;
  }
  
  const powerValues = workout.telemetry
    .filter(p => p.power > 0)
    .map(p => p.power);
  
  for (const duration of durations) {
    if (powerValues.length < duration) continue;
    
    // Find best average for this duration
    let bestAvg = 0;
    for (let i = 0; i <= powerValues.length - duration; i++) {
      const window = powerValues.slice(i, i + duration);
      const avg = window.reduce((a, b) => a + b, 0) / duration;
      bestAvg = Math.max(bestAvg, avg);
    }
    
    if (bestAvg === 0) continue;
    
    // Check against existing record
    const existingRecord = await PersonalRecord.findOne({
      userId,
      metric: 'power',
      duration,
    });
    
    if (!existingRecord || bestAvg > existingRecord.value) {
      await PersonalRecord.findOneAndUpdate(
        { userId, metric: 'power', duration },
        {
          userId,
          workoutId: workout._id,
          metric: 'power',
          duration,
          value: Math.round(bestAvg),
          achievedAt: workout.startTime,
          previousValue: existingRecord?.value,
          improvement: existingRecord 
            ? Math.round((bestAvg - existingRecord.value) / existingRecord.value * 100)
            : null,
        },
        { upsert: true, new: true }
      );
      
      records.push({
        metric: 'power',
        duration,
        value: Math.round(bestAvg),
      });
    }
  }
  
  return records;
}

module.exports = {
  createWorkout,
  completeWorkout,
  getWorkoutHistory,
  getWorkout,
  getActiveWorkoutByStream,
  calculateSummary,
  checkPersonalRecords,
};
```

---

## Server Integration

Update `packages/service/src/server.js`:

```javascript
// Add imports
const { connectDatabase, disconnectDatabase, checkConnection } = require('./db');
const workoutService = require('./db/workoutService');

// Connect to MongoDB on startup
connectDatabase().catch(console.error);

// Enhanced health check
app.get('/health', async (req, res) => {
  const mongoHealthy = await checkConnection();
  const redisHealthy = redisClient.isReady;
  
  if (mongoHealthy && redisHealthy) {
    res.json({ status: 'ok', mongodb: 'connected', redis: 'connected' });
  } else {
    res.status(503).json({ 
      status: 'degraded',
      mongodb: mongoHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
    });
  }
});

// Workout endpoints (similar to PostgreSQL implementation)
// ... see PostgreSQL guide for endpoint implementations

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await disconnectDatabase();
  await redisClient.quit();
  process.exit(0);
});
```

---

## Indexing Strategy

### Recommended Indexes

```javascript
// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ 'oauth.provider': 1, 'oauth.providerId': 1 });
db.users.createIndex({ 'apiKeys.keyHash': 1 });

// Workout indexes
db.workouts.createIndex({ userId: 1, startTime: -1 });
db.workouts.createIndex({ userId: 1, status: 1 });
db.workouts.createIndex({ streamName: 1 }, { sparse: true });
db.workouts.createIndex({ 'summary.avgPower': -1 });
db.workouts.createIndex({ tags: 1 });

// Text index for search
db.workouts.createIndex({ title: 'text', description: 'text' });

// Personal records indexes
db.personalrecords.createIndex({ userId: 1, metric: 1, duration: 1 }, { unique: true });
db.personalrecords.createIndex({ achievedAt: -1 });
```

### Query Performance

```javascript
// Check query performance
db.workouts.find({ userId: ObjectId('...'), status: 'COMPLETED' })
  .sort({ startTime: -1 })
  .explain('executionStats');
```

---

## Aggregation Pipelines

### Monthly Statistics

```javascript
async function getMonthlyStats(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const result = await Workout.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: startDate, $lte: endDate },
        status: 'COMPLETED',
      },
    },
    {
      $group: {
        _id: null,
        workoutCount: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        totalEnergy: { $sum: '$summary.totalEnergy' },
        avgPower: { $avg: '$summary.avgPower' },
        maxPower: { $max: '$summary.maxPower' },
      },
    },
  ]);
  
  return result[0] || {
    workoutCount: 0,
    totalDuration: 0,
    totalEnergy: 0,
    avgPower: null,
    maxPower: null,
  };
}
```

### Weekly Summary

```javascript
async function getWeeklyTrend(userId, weeks = 8) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));
  
  return Workout.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: startDate },
        status: 'COMPLETED',
      },
    },
    {
      $group: {
        _id: {
          year: { $isoWeekYear: '$startTime' },
          week: { $isoWeek: '$startTime' },
        },
        workoutCount: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        avgPower: { $avg: '$summary.avgPower' },
      },
    },
    { $sort: { '_id.year': 1, '_id.week': 1 } },
  ]);
}
```

### Power Duration Curve

```javascript
async function getPowerCurve(userId, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return PersonalRecord.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        metric: 'power',
        achievedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$duration',
        maxValue: { $max: '$value' },
      },
    },
    { $sort: { '_id': 1 } },
    {
      $project: {
        duration: '$_id',
        power: '$maxValue',
        _id: 0,
      },
    },
  ]);
}
```

---

## Backup & Recovery

### Automated Backup Script

Create `packages/service/scripts/backup-mongo.sh`:

```bash
#!/bin/bash

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_USER="${MONGO_USER:-biketracker}"
MONGO_DB="${MONGO_DB:-biketracker}"

mkdir -p "$BACKUP_DIR"

# Create backup
docker exec bike_tracker_mongodb mongodump \
  --host "$MONGO_HOST" \
  --username "$MONGO_USER" \
  --password "$MONGO_PASSWORD" \
  --authenticationDatabase admin \
  --db "$MONGO_DB" \
  --archive="/tmp/backup-$TIMESTAMP.gz" \
  --gzip

# Copy from container
docker cp "bike_tracker_mongodb:/tmp/backup-$TIMESTAMP.gz" "$BACKUP_DIR/"

# Clean old backups
find "$BACKUP_DIR" -name "backup-*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: backup-$TIMESTAMP.gz"
```

### Restore from Backup

```bash
# Copy backup to container
docker cp backups/backup-20250101-120000.gz bike_tracker_mongodb:/tmp/

# Restore
docker exec bike_tracker_mongodb mongorestore \
  --host mongodb \
  --username biketracker \
  --password "$MONGO_PASSWORD" \
  --authenticationDatabase admin \
  --db biketracker \
  --archive=/tmp/backup-20250101-120000.gz \
  --gzip \
  --drop
```

### Continuous Backup with Oplog

For production environments requiring point-in-time recovery:

```bash
# Start oplog tailing
mongodump --host mongodb --oplog --archive=/backups/oplog.gz --gzip
```

---

## Performance Optimization

### Connection Pooling

```javascript
// In db/index.js
const options = {
  maxPoolSize: 50,        // Maximum connections
  minPoolSize: 5,         // Minimum connections to maintain
  maxIdleTimeMS: 30000,   // Close idle connections after 30s
  waitQueueTimeoutMS: 10000,
};
```

### Document Size Optimization

For large telemetry data, consider external storage:

```javascript
// Store telemetry in GridFS for large workouts
const { GridFSBucket } = require('mongodb');

async function storeTelemetry(workoutId, telemetryData) {
  const bucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'telemetry',
  });
  
  const stream = bucket.openUploadStream(`${workoutId}.json`, {
    metadata: { workoutId, compressed: true },
  });
  
  const compressed = zlib.gzipSync(JSON.stringify(telemetryData));
  stream.end(compressed);
  
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(stream.id));
    stream.on('error', reject);
  });
}
```

### Read Preferences for Analytics

```javascript
// Use secondary for heavy analytics queries
const stats = await Workout.aggregate([...])
  .read('secondaryPreferred')
  .exec();
```

### Caching Strategies

```javascript
// Cache frequently accessed data in Redis
async function getCachedStats(userId, key, ttl = 300) {
  const cached = await redisClient.get(`stats:${userId}:${key}`);
  if (cached) return JSON.parse(cached);
  
  const stats = await calculateStats(userId);
  await redisClient.setEx(`stats:${userId}:${key}`, ttl, JSON.stringify(stats));
  
  return stats;
}
```

---

## Troubleshooting

### Connection Issues

```bash
# Check MongoDB status
docker exec bike_tracker_mongodb mongosh --eval "db.adminCommand('ping')"

# Check connections
docker exec bike_tracker_mongodb mongosh --eval "db.serverStatus().connections"

# View logs
docker logs bike_tracker_mongodb
```

### Slow Queries

```javascript
// Enable profiling
db.setProfilingLevel(1, { slowms: 100 });

// View slow queries
db.system.profile.find().sort({ ts: -1 }).limit(10);
```

### Memory Issues

```bash
# Check memory usage
docker exec bike_tracker_mongodb mongosh --eval "db.serverStatus().mem"

# Adjust WiredTiger cache (in docker-compose)
command: ["--wiredTigerCacheSizeGB", "0.5"]
```

### Index Optimization

```javascript
// Check index usage
db.workouts.aggregate([
  { $indexStats: {} }
]);

// Find missing indexes
db.workouts.find({ userId: ObjectId('...') }).explain('executionStats');
// Look for COLLSCAN (full collection scan)
```
