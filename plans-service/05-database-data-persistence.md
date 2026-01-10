# Database and Data Persistence Plan

## Overview

This plan addresses database schema improvements, data validation, query optimization, and persistence reliability for the Prisma-based data layer.

## Current State Assessment

### Strengths
- Well-designed Prisma schema with proper relationships
- Supports both SQLite and PostgreSQL
- Index optimization on frequently queried fields
- Cascade delete on user deletion
- Optional database (can run without persistence)

### Issues Identified

1. **JSON stringification for telemetry** - Multiple parse/stringify cycles
2. **No validation of parsed JSON structure** - Could corrupt data
3. **Missing database error handling** - Only checks for P2025
4. **Incomplete data model** - Status as string instead of enum
5. **Settings stored as JSON string** - Type safety issues
6. **No data size limits** - Large telemetry could exceed limits
7. **Missing data migration strategy** - Schema changes could break data

---

## Implementation Plan

### Phase 1: Schema Improvements

**Priority: HIGH**

#### 1.1 Add status enum

**File: `packages/service/prisma/schema.prisma`**

```prisma
enum WorkoutStatus {
  PENDING
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
  ERROR
}

model Workout {
  id          String        @id @default(cuid())
  userId      String?
  user        User?         @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Use enum instead of string
  status      WorkoutStatus @default(PENDING)

  name        String?
  startTime   DateTime      @default(now())
  endTime     DateTime?
  duration    Int?          // Duration in seconds

  // Structured fields instead of JSON strings
  telemetryCount Int        @default(0)  // Track telemetry size
  summaryJson    String?    @map("summary")
  settingsJson   String?    @map("settings")

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Separate telemetry into its own table for large datasets
  telemetry   TelemetryPoint[]

  @@index([userId])
  @@index([status])
  @@index([startTime])
  @@index([createdAt])
}

// Separate model for telemetry to handle large datasets
model TelemetryPoint {
  id          String   @id @default(cuid())
  workoutId   String
  workout     Workout  @relation(fields: [workoutId], references: [id], onDelete: Cascade)

  timestamp   DateTime
  sequence    Int      // Order within workout

  // Metrics
  power       Float?
  cadence     Float?
  heartRate   Float?
  speed       Float?
  distance    Float?
  elevation   Float?
  latitude    Float?
  longitude   Float?

  @@index([workoutId, sequence])
  @@index([workoutId, timestamp])
}
```

#### 1.2 Add data constraints

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?   @db.VarChar(255)  // Limit name length
  apiKey    String?   @unique @db.VarChar(64)  // Limit key length

  // Structured settings instead of JSON
  ftp       Int?      // Functional Threshold Power
  weight    Float?    // Weight in kg

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  workouts  Workout[]
  settings  UserSettings?
}

model UserSettings {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Bike settings
  wheelCircumference  Float?
  crankLength         Float?

  // Display preferences
  units               String  @default("metric")  // metric or imperial
  dateFormat          String  @default("ISO")

  // Zone definitions (JSON but validated)
  powerZones          String? @db.Text
  heartRateZones      String? @db.Text

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

---

### Phase 2: Data Access Layer

**Priority: HIGH**

#### 2.1 Create repository pattern

**File: `packages/service/src/db/repositories/workoutRepository.ts`**

```typescript
import { PrismaClient, Workout, WorkoutStatus, Prisma } from '@prisma/client';
import { WorkoutSummary, WorkoutSettings, TelemetryPoint } from '../../types/workout.js';
import { safeJsonParseOrNull, safeJsonParseOrThrow } from '../../utils/safeJson.js';
import { workoutSummarySchema, workoutSettingsSchema } from '../../schemas/workout.js';
import { NotFoundError, ValidationError } from '../../errors.js';

export interface WorkoutWithParsedData extends Omit<Workout, 'summaryJson' | 'settingsJson'> {
  summary: WorkoutSummary | null;
  settings: WorkoutSettings | null;
}

export interface CreateWorkoutInput {
  userId?: string;
  name?: string;
  status?: WorkoutStatus;
  settings?: WorkoutSettings;
}

export interface UpdateWorkoutInput {
  name?: string;
  status?: WorkoutStatus;
  endTime?: Date;
  duration?: number;
  summary?: WorkoutSummary;
  settings?: WorkoutSettings;
}

export class WorkoutRepository {
  constructor(private prisma: PrismaClient) {}

  private toWorkoutWithParsedData(workout: Workout): WorkoutWithParsedData {
    const { summaryJson, settingsJson, ...rest } = workout;
    return {
      ...rest,
      summary: safeJsonParseOrNull(summaryJson, workoutSummarySchema),
      settings: safeJsonParseOrNull(settingsJson, workoutSettingsSchema),
    };
  }

  async findById(id: string): Promise<WorkoutWithParsedData | null> {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
    });

    return workout ? this.toWorkoutWithParsedData(workout) : null;
  }

  async findByIdOrThrow(id: string): Promise<WorkoutWithParsedData> {
    const workout = await this.findById(id);
    if (!workout) {
      throw new NotFoundError(`Workout not found: ${id}`);
    }
    return workout;
  }

  async findByUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: WorkoutStatus;
      orderBy?: 'startTime' | 'createdAt';
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<WorkoutWithParsedData[]> {
    const {
      limit = 50,
      offset = 0,
      status,
      orderBy = 'startTime',
      order = 'desc',
    } = options;

    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      take: limit,
      skip: offset,
      orderBy: { [orderBy]: order },
    });

    return workouts.map((w) => this.toWorkoutWithParsedData(w));
  }

  async create(input: CreateWorkoutInput): Promise<WorkoutWithParsedData> {
    const workout = await this.prisma.workout.create({
      data: {
        userId: input.userId,
        name: input.name,
        status: input.status ?? WorkoutStatus.PENDING,
        settingsJson: input.settings ? JSON.stringify(input.settings) : null,
      },
    });

    return this.toWorkoutWithParsedData(workout);
  }

  async update(id: string, input: UpdateWorkoutInput): Promise<WorkoutWithParsedData> {
    // Validate summary if provided
    if (input.summary) {
      try {
        workoutSummarySchema.parse(input.summary);
      } catch (error) {
        throw new ValidationError('Invalid workout summary format');
      }
    }

    // Validate settings if provided
    if (input.settings) {
      try {
        workoutSettingsSchema.parse(input.settings);
      } catch (error) {
        throw new ValidationError('Invalid workout settings format');
      }
    }

    const workout = await this.prisma.workout.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.endTime !== undefined && { endTime: input.endTime }),
        ...(input.duration !== undefined && { duration: input.duration }),
        ...(input.summary !== undefined && {
          summaryJson: JSON.stringify(input.summary),
        }),
        ...(input.settings !== undefined && {
          settingsJson: JSON.stringify(input.settings),
        }),
      },
    });

    return this.toWorkoutWithParsedData(workout);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.workout.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError(`Workout not found: ${id}`);
      }
      throw error;
    }
  }

  async addTelemetry(
    workoutId: string,
    points: TelemetryPoint[]
  ): Promise<number> {
    // Validate workout exists
    await this.findByIdOrThrow(workoutId);

    // Get current sequence number
    const lastPoint = await this.prisma.telemetryPoint.findFirst({
      where: { workoutId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });

    let sequence = (lastPoint?.sequence ?? -1) + 1;

    // Batch insert telemetry
    const data = points.map((point) => ({
      workoutId,
      sequence: sequence++,
      timestamp: new Date(point.timestamp),
      power: point.power,
      cadence: point.cadence,
      heartRate: point.heartRate,
      speed: point.speed,
      distance: point.distance,
      elevation: point.elevation,
      latitude: point.latitude,
      longitude: point.longitude,
    }));

    const result = await this.prisma.telemetryPoint.createMany({
      data,
    });

    // Update telemetry count
    await this.prisma.workout.update({
      where: { id: workoutId },
      data: {
        telemetryCount: { increment: result.count },
      },
    });

    return result.count;
  }

  async getTelemetry(
    workoutId: string,
    options: {
      start?: number;
      end?: number;
      downsample?: number;
    } = {}
  ): Promise<TelemetryPoint[]> {
    const { start = 0, end, downsample } = options;

    // Build query
    const where: Prisma.TelemetryPointWhereInput = {
      workoutId,
      sequence: {
        gte: start,
        ...(end !== undefined && { lte: end }),
      },
    };

    // If downsampling, use raw query for efficiency
    if (downsample && downsample > 1) {
      // Get every Nth point
      const points = await this.prisma.$queryRaw<TelemetryPoint[]>`
        SELECT * FROM TelemetryPoint
        WHERE workoutId = ${workoutId}
          AND sequence >= ${start}
          ${end !== undefined ? Prisma.sql`AND sequence <= ${end}` : Prisma.empty}
          AND sequence % ${downsample} = 0
        ORDER BY sequence ASC
      `;
      return points;
    }

    return this.prisma.telemetryPoint.findMany({
      where,
      orderBy: { sequence: 'asc' },
    });
  }
}
```

#### 2.2 Create telemetry repository

**File: `packages/service/src/db/repositories/telemetryRepository.ts`**

```typescript
import { PrismaClient, Prisma } from '@prisma/client';
import { TelemetryPoint } from '../../types/workout.js';

export interface TelemetryStats {
  count: number;
  avgPower: number | null;
  maxPower: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  totalDistance: number | null;
  elevationGain: number | null;
}

export class TelemetryRepository {
  constructor(private prisma: PrismaClient) {}

  async getStats(workoutId: string): Promise<TelemetryStats> {
    const result = await this.prisma.telemetryPoint.aggregate({
      where: { workoutId },
      _count: true,
      _avg: {
        power: true,
        cadence: true,
        heartRate: true,
      },
      _max: {
        power: true,
        cadence: true,
        heartRate: true,
        distance: true,
      },
    });

    // Calculate elevation gain separately (requires ordered data)
    const elevationGain = await this.calculateElevationGain(workoutId);

    return {
      count: result._count,
      avgPower: result._avg.power,
      maxPower: result._max.power,
      avgCadence: result._avg.cadence,
      maxCadence: result._max.cadence,
      avgHeartRate: result._avg.heartRate,
      maxHeartRate: result._max.heartRate,
      totalDistance: result._max.distance,
      elevationGain,
    };
  }

  private async calculateElevationGain(workoutId: string): Promise<number | null> {
    const points = await this.prisma.telemetryPoint.findMany({
      where: { workoutId, elevation: { not: null } },
      orderBy: { sequence: 'asc' },
      select: { elevation: true },
    });

    if (points.length < 2) return null;

    let gain = 0;
    for (let i = 1; i < points.length; i++) {
      const diff = (points[i].elevation ?? 0) - (points[i - 1].elevation ?? 0);
      if (diff > 0) gain += diff;
    }

    return gain;
  }

  async getTimeRange(
    workoutId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryPoint[]> {
    return this.prisma.telemetryPoint.findMany({
      where: {
        workoutId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  async deleteOlderThan(workoutId: string, timestamp: Date): Promise<number> {
    const result = await this.prisma.telemetryPoint.deleteMany({
      where: {
        workoutId,
        timestamp: { lt: timestamp },
      },
    });
    return result.count;
  }

  async compact(
    workoutId: string,
    keepEveryNth: number
  ): Promise<{ deleted: number; remaining: number }> {
    // Get all sequence numbers
    const points = await this.prisma.telemetryPoint.findMany({
      where: { workoutId },
      select: { id: true, sequence: true },
      orderBy: { sequence: 'asc' },
    });

    // Determine which to delete
    const toDelete = points
      .filter((p) => p.sequence % keepEveryNth !== 0)
      .map((p) => p.id);

    if (toDelete.length === 0) {
      return { deleted: 0, remaining: points.length };
    }

    // Batch delete
    const result = await this.prisma.telemetryPoint.deleteMany({
      where: { id: { in: toDelete } },
    });

    return {
      deleted: result.count,
      remaining: points.length - result.count,
    };
  }
}
```

---

### Phase 3: Error Handling

**Priority: HIGH**

#### 3.1 Comprehensive Prisma error handling

**File: `packages/service/src/db/errors.ts`**

```typescript
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError, ValidationError } from '../errors.js';
import { logger } from '../logger.js';

export class DatabaseError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 500, true, cause, { type: 'database' });
  }
}

export class UniqueConstraintError extends AppError {
  constructor(field: string, cause?: Error) {
    super(`${field} already exists`, 409, true, cause, { field });
  }
}

export class ForeignKeyError extends AppError {
  constructor(relation: string, cause?: Error) {
    super(`Related ${relation} not found`, 400, true, cause, { relation });
  }
}

/**
 * Map Prisma errors to application errors
 */
export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const code = error.code;
    const meta = error.meta as Record<string, unknown> | undefined;

    switch (code) {
      case 'P2002': {
        // Unique constraint violation
        const field = (meta?.target as string[])?.join(', ') || 'field';
        throw new UniqueConstraintError(field, error);
      }

      case 'P2003': {
        // Foreign key constraint violation
        const relation = (meta?.field_name as string) || 'record';
        throw new ForeignKeyError(relation, error);
      }

      case 'P2025': {
        // Record not found
        const model = (meta?.modelName as string) || 'Record';
        throw new NotFoundError(`${model} not found`, error);
      }

      case 'P2014': {
        // Required relation violation
        throw new ValidationError(
          'Required related record is missing',
          error
        );
      }

      case 'P2021': {
        // Table doesn't exist
        logger.error({ error, code }, 'Database table missing');
        throw new DatabaseError('Database schema error', error);
      }

      default:
        logger.error({ error, code, meta }, 'Unknown Prisma error');
        throw new DatabaseError(`Database error: ${code}`, error);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new ValidationError('Invalid query parameters', error);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ error }, 'Database initialization failed');
    throw new DatabaseError('Database connection failed', error);
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    logger.error({ error }, 'Database engine panic');
    throw new DatabaseError('Database engine error', error);
  }

  // Re-throw if already an AppError
  if (error instanceof AppError) {
    throw error;
  }

  // Unknown error
  logger.error({ error }, 'Unknown database error');
  throw new DatabaseError(
    'An unexpected database error occurred',
    error instanceof Error ? error : undefined
  );
}

/**
 * Wrap database operations with error handling
 */
export async function withDbErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handlePrismaError(error);
  }
}
```

---

### Phase 4: Data Validation

**Priority: MEDIUM**

#### 4.1 Create validation schemas

**File: `packages/service/src/schemas/database.ts`**

```typescript
import { z } from 'zod';

/**
 * Workout summary validation schema
 */
export const workoutSummaryDbSchema = z.object({
  duration: z.number().int().min(0),
  distance: z.number().min(0).optional(),
  avgPower: z.number().min(0).max(3000).optional(),
  maxPower: z.number().min(0).max(3000).optional(),
  avgCadence: z.number().min(0).max(300).optional(),
  maxCadence: z.number().min(0).max(300).optional(),
  avgHeartRate: z.number().min(30).max(250).optional(),
  maxHeartRate: z.number().min(30).max(250).optional(),
  normalizedPower: z.number().min(0).max(3000).optional(),
  intensityFactor: z.number().min(0).max(2).optional(),
  trainingStressScore: z.number().min(0).max(1000).optional(),
  calories: z.number().int().min(0).optional(),
});

/**
 * Telemetry point validation schema with realistic limits
 */
export const telemetryPointDbSchema = z.object({
  timestamp: z.number().int().positive(),
  power: z.number().min(0).max(3000).optional(),
  cadence: z.number().min(0).max(300).optional(),
  heartRate: z.number().min(30).max(250).optional(),
  speed: z.number().min(0).max(100).optional(), // m/s
  distance: z.number().min(0).optional(),
  elevation: z.number().min(-500).max(9000).optional(), // meters
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Power zones validation
 */
export const powerZonesSchema = z.array(
  z.object({
    name: z.string().min(1).max(50),
    min: z.number().min(0).max(3000),
    max: z.number().min(0).max(3000),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
).max(10);

/**
 * Heart rate zones validation
 */
export const heartRateZonesSchema = z.array(
  z.object({
    name: z.string().min(1).max(50),
    min: z.number().min(30).max(250),
    max: z.number().min(30).max(250),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
).max(10);

/**
 * User settings validation
 */
export const userSettingsDbSchema = z.object({
  ftp: z.number().int().min(50).max(500).optional(),
  weight: z.number().min(30).max(300).optional(), // kg
  wheelCircumference: z.number().min(1000).max(3000).optional(), // mm
  crankLength: z.number().min(100).max(200).optional(), // mm
  units: z.enum(['metric', 'imperial']).optional(),
  dateFormat: z.enum(['ISO', 'US', 'EU']).optional(),
  powerZones: powerZonesSchema.optional(),
  heartRateZones: heartRateZonesSchema.optional(),
});
```

#### 4.2 Data size limits

**File: `packages/service/src/db/limits.ts`**

```typescript
export const DATA_LIMITS = {
  // Maximum telemetry points per workout
  MAX_TELEMETRY_POINTS: parseInt(process.env.MAX_TELEMETRY_POINTS || '86400', 10), // 24 hours at 1/sec

  // Maximum workout duration (24 hours in seconds)
  MAX_WORKOUT_DURATION: 86400,

  // Maximum summary JSON size (10KB)
  MAX_SUMMARY_SIZE: 10 * 1024,

  // Maximum settings JSON size (5KB)
  MAX_SETTINGS_SIZE: 5 * 1024,

  // Maximum telemetry batch size
  MAX_TELEMETRY_BATCH: 1000,

  // Minimum telemetry interval (1 second)
  MIN_TELEMETRY_INTERVAL: 1000,
};

export function validateTelemetryCount(
  currentCount: number,
  newPoints: number
): void {
  if (currentCount + newPoints > DATA_LIMITS.MAX_TELEMETRY_POINTS) {
    throw new Error(
      `Telemetry limit exceeded: ${currentCount + newPoints} > ${DATA_LIMITS.MAX_TELEMETRY_POINTS}`
    );
  }
}

export function validateJsonSize(json: string, maxSize: number, name: string): void {
  if (json.length > maxSize) {
    throw new Error(
      `${name} too large: ${json.length} bytes > ${maxSize} bytes`
    );
  }
}
```

---

### Phase 5: Migration Strategy

**Priority: MEDIUM**

#### 5.1 Create migration helpers

**File: `packages/service/src/db/migrations/helpers.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from '../../logger.js';

/**
 * Safe migration wrapper with rollback support
 */
export async function runMigration<T>(
  prisma: PrismaClient,
  name: string,
  migrate: (prisma: PrismaClient) => Promise<T>,
  rollback?: (prisma: PrismaClient) => Promise<void>
): Promise<T> {
  logger.info({ migration: name }, 'Starting migration');

  try {
    const result = await prisma.$transaction(async (tx) => {
      return migrate(tx as PrismaClient);
    });

    logger.info({ migration: name }, 'Migration completed successfully');
    return result;
  } catch (error) {
    logger.error({ migration: name, error }, 'Migration failed');

    if (rollback) {
      logger.info({ migration: name }, 'Attempting rollback');
      try {
        await rollback(prisma);
        logger.info({ migration: name }, 'Rollback completed');
      } catch (rollbackError) {
        logger.error(
          { migration: name, error: rollbackError },
          'Rollback failed'
        );
      }
    }

    throw error;
  }
}

/**
 * Batch processing for large data migrations
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  onProgress?: (processed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }

  return results;
}
```

#### 5.2 Example migration: JSON to separate table

**File: `packages/service/src/db/migrations/001-telemetry-to-table.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { runMigration, batchProcess } from './helpers.js';
import { logger } from '../../logger.js';

interface LegacyWorkout {
  id: string;
  telemetry: string | null;
}

/**
 * Migrate telemetry from JSON column to separate table
 */
export async function migrateTelemetryToTable(
  prisma: PrismaClient
): Promise<{ workoutsProcessed: number; pointsCreated: number }> {
  return runMigration(
    prisma,
    'telemetry-to-table',
    async (tx) => {
      // Find workouts with legacy JSON telemetry
      const workouts = await tx.$queryRaw<LegacyWorkout[]>`
        SELECT id, telemetry FROM Workout
        WHERE telemetry IS NOT NULL
        AND telemetry != ''
      `;

      let pointsCreated = 0;

      await batchProcess(
        workouts,
        10,
        async (batch) => {
          for (const workout of batch) {
            if (!workout.telemetry) continue;

            try {
              const points = JSON.parse(workout.telemetry);
              if (!Array.isArray(points)) continue;

              // Insert telemetry points
              const data = points.map((p: any, index: number) => ({
                workoutId: workout.id,
                sequence: index,
                timestamp: new Date(p.timestamp),
                power: p.power ?? null,
                cadence: p.cadence ?? null,
                heartRate: p.heartRate ?? null,
                speed: p.speed ?? null,
                distance: p.distance ?? null,
                elevation: p.elevation ?? null,
                latitude: p.latitude ?? null,
                longitude: p.longitude ?? null,
              }));

              await tx.telemetryPoint.createMany({ data });
              pointsCreated += data.length;

              // Clear legacy field
              await tx.workout.update({
                where: { id: workout.id },
                data: {
                  telemetry: null,
                  telemetryCount: data.length,
                },
              });
            } catch (error) {
              logger.warn(
                { workoutId: workout.id, error },
                'Failed to migrate workout telemetry'
              );
            }
          }
          return batch;
        },
        (processed, total) => {
          logger.info(
            { processed, total },
            'Telemetry migration progress'
          );
        }
      );

      return {
        workoutsProcessed: workouts.length,
        pointsCreated,
      };
    }
  );
}
```

---

### Phase 6: Query Optimization

**Priority: LOW**

#### 6.1 Create query builders

**File: `packages/service/src/db/queries/workoutQueries.ts`**

```typescript
import { Prisma } from '@prisma/client';

export interface WorkoutFilters {
  userId?: string;
  status?: string | string[];
  startDateFrom?: Date;
  startDateTo?: Date;
  minDuration?: number;
  maxDuration?: number;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: 'startTime' | 'duration' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Build workout filter query
 */
export function buildWorkoutFilter(
  filters: WorkoutFilters
): Prisma.WorkoutWhereInput {
  const where: Prisma.WorkoutWhereInput = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status as any }
      : (filters.status as any);
  }

  if (filters.startDateFrom || filters.startDateTo) {
    where.startTime = {
      ...(filters.startDateFrom && { gte: filters.startDateFrom }),
      ...(filters.startDateTo && { lte: filters.startDateTo }),
    };
  }

  if (filters.minDuration || filters.maxDuration) {
    where.duration = {
      ...(filters.minDuration && { gte: filters.minDuration }),
      ...(filters.maxDuration && { lte: filters.maxDuration }),
    };
  }

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: 'insensitive',
    };
  }

  return where;
}

/**
 * Build pagination query
 */
export function buildPagination(options: PaginationOptions): {
  skip: number;
  take: number;
  orderBy: Prisma.WorkoutOrderByWithRelationInput;
} {
  const { page, pageSize, sortBy = 'startTime', sortOrder = 'desc' } = options;

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { [sortBy]: sortOrder },
  };
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/service/src/db/repositories/workoutRepository.ts` | Workout data access |
| `packages/service/src/db/repositories/telemetryRepository.ts` | Telemetry data access |
| `packages/service/src/db/errors.ts` | Prisma error handling |
| `packages/service/src/schemas/database.ts` | Data validation schemas |
| `packages/service/src/db/limits.ts` | Data size limits |
| `packages/service/src/db/migrations/helpers.ts` | Migration utilities |
| `packages/service/src/db/queries/workoutQueries.ts` | Query builders |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/service/prisma/schema.prisma` | Add enum, constraints, relations |
| `packages/service/src/db/workoutService.ts` | Use repository pattern |
| `packages/service/src/routes/workouts.ts` | Use typed repository |

---

## Testing Requirements

### Unit Tests
- Repository methods return correct types
- Error handling maps all Prisma codes
- Data validation rejects invalid values
- Migration helpers handle failures

### Integration Tests
- Repository CRUD operations work correctly
- Telemetry batch insertion performs well
- Query filters return correct results
- Migrations complete successfully

### Performance Tests
- Large telemetry insertion (10k+ points)
- Query performance with filters
- Aggregation performance

---

## Success Metrics

1. **Zero JSON parse failures** in production
2. **All data validated** before persistence
3. **Query latency** < 50ms for common operations
4. **Migration safety** with rollback support
5. **Type safety** through entire data layer

---

## Estimated Effort

- Phase 1: 2-3 hours (schema improvements)
- Phase 2: 4-6 hours (repository pattern)
- Phase 3: 2-3 hours (error handling)
- Phase 4: 2-3 hours (validation)
- Phase 5: 3-4 hours (migration strategy)
- Phase 6: 2-3 hours (query optimization)

**Total: 15-22 hours**
