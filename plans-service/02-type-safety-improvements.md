# Type Safety Improvements Plan

## Overview

This plan addresses type safety concerns across the codebase, focusing on eliminating `any` types, adding proper type guards for runtime data, and ensuring type-safe JSON parsing operations.

## Current State Assessment

### Strengths
- Strict TypeScript mode enabled across all packages
- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- Well-defined type files in `packages/service/src/types/`
- Zod schemas for request validation

### Issues Identified

1. **5 instances of `any` type** in service code
2. **Inline type assertions** for runtime data (`as { streamName?: unknown }`)
3. **JSON parsing without validation** (telemetry data in workoutService.ts)
4. **Generic type assertions** (`as Error`) without guards
5. **Missing type guards** for external data boundaries

---

## Implementation Plan

### Phase 1: Eliminate `any` Types

**Priority: HIGH**

#### 1.1 Audit and replace `any` types

**Current instances to fix:**

**File: `packages/service/src/routes/streams.ts`**

```typescript
// Current (line ~88)
const { streamName } = req.body as { streamName?: unknown };

// Replace with Zod validation
const bodySchema = z.object({
  streamName: streamNameSchema,
});
const { streamName } = bodySchema.parse(req.body);
```

**File: `packages/service/src/db/workoutService.ts`**

```typescript
// Current - JSON.parse returns any
const settings = JSON.parse(workout.settings as string);

// Replace with typed parser (see Phase 2)
const settings = parseWorkoutSettings(workout.settings);
```

#### 1.2 Create strict ESLint rule

**File: `.eslintrc.js` or `eslint.config.js`**

```javascript
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
  }
}
```

---

### Phase 2: Type-Safe JSON Parsing

**Priority: HIGH**

#### 2.1 Create type guard utilities

**File: `packages/service/src/utils/typeGuards.ts`**

```typescript
/**
 * Type guard to check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if value is a number (and not NaN)
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Type guard for optional string
 */
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Type guard for optional number
 */
export function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && !Number.isNaN(value));
}
```

#### 2.2 Create Zod schemas for JSON data structures

**File: `packages/service/src/schemas/workout.ts`**

```typescript
import { z } from 'zod';

/**
 * Telemetry data point schema
 */
export const telemetryPointSchema = z.object({
  timestamp: z.number(),
  power: z.number().optional(),
  cadence: z.number().optional(),
  heartRate: z.number().optional(),
  speed: z.number().optional(),
  distance: z.number().optional(),
  elevation: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type TelemetryPoint = z.infer<typeof telemetryPointSchema>;

/**
 * Workout telemetry array schema
 */
export const telemetryArraySchema = z.array(telemetryPointSchema);

export type TelemetryArray = z.infer<typeof telemetryArraySchema>;

/**
 * Workout summary schema
 */
export const workoutSummarySchema = z.object({
  duration: z.number(),
  distance: z.number().optional(),
  avgPower: z.number().optional(),
  maxPower: z.number().optional(),
  avgCadence: z.number().optional(),
  maxCadence: z.number().optional(),
  avgHeartRate: z.number().optional(),
  maxHeartRate: z.number().optional(),
  normalizedPower: z.number().optional(),
  intensityFactor: z.number().optional(),
  trainingStressScore: z.number().optional(),
  calories: z.number().optional(),
});

export type WorkoutSummary = z.infer<typeof workoutSummarySchema>;

/**
 * Workout settings schema
 */
export const workoutSettingsSchema = z.object({
  ftp: z.number().optional(),
  weight: z.number().optional(),
  zones: z.array(z.object({
    name: z.string(),
    min: z.number(),
    max: z.number(),
  })).optional(),
  autoLap: z.boolean().optional(),
  lapDistance: z.number().optional(),
});

export type WorkoutSettings = z.infer<typeof workoutSettingsSchema>;
```

#### 2.3 Create safe JSON parse functions

**File: `packages/service/src/utils/safeJson.ts`**

```typescript
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Result type for safe JSON operations
 */
type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Safely parse JSON string and validate against schema
 */
export function safeJsonParse<T>(
  json: string | null | undefined,
  schema: ZodSchema<T>
): ParseResult<T> {
  if (json === null || json === undefined) {
    return { success: false, error: new Error('JSON string is null or undefined') };
  }

  try {
    const parsed: unknown = JSON.parse(json);
    const validated = schema.parse(parsed);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: new Error(`Invalid JSON: ${error.message}`) };
    }
    if (error instanceof ZodError) {
      return { success: false, error: new ValidationError(`Schema validation failed: ${error.message}`) };
    }
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Parse JSON with schema, returning null on failure
 */
export function safeJsonParseOrNull<T>(
  json: string | null | undefined,
  schema: ZodSchema<T>
): T | null {
  const result = safeJsonParse(json, schema);
  return result.success ? result.data : null;
}

/**
 * Parse JSON with schema, throwing on failure
 */
export function safeJsonParseOrThrow<T>(
  json: string | null | undefined,
  schema: ZodSchema<T>,
  context?: string
): T {
  const result = safeJsonParse(json, schema);
  if (!result.success) {
    throw new ValidationError(
      context
        ? `${context}: ${result.error.message}`
        : result.error.message
    );
  }
  return result.data;
}
```

#### 2.4 Update workoutService.ts to use safe parsing

**File: `packages/service/src/db/workoutService.ts`**

```typescript
import {
  telemetryArraySchema,
  workoutSummarySchema,
  workoutSettingsSchema
} from '../schemas/workout.js';
import { safeJsonParseOrNull, safeJsonParseOrThrow } from '../utils/safeJson.js';

// Replace current JSON.parse calls:

// Current:
// const telemetry = JSON.parse(workout.telemetry as string);

// New:
const telemetry = safeJsonParseOrNull(
  workout.telemetry,
  telemetryArraySchema
);

// For required fields that should throw:
const summary = safeJsonParseOrThrow(
  workout.summary,
  workoutSummarySchema,
  `Workout ${workout.id} summary`
);
```

---

### Phase 3: Type-Safe Error Handling

**Priority: MEDIUM**

#### 3.1 Create error type guard

**File: `packages/service/src/utils/typeGuards.ts`**

```typescript
/**
 * Type guard to check if value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard for Node.js system errors with code property
 */
export interface SystemError extends Error {
  code: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

export function isSystemError(value: unknown): value is SystemError {
  return isError(value) && 'code' in value && typeof (value as SystemError).code === 'string';
}

/**
 * Type guard for Prisma errors
 */
export interface PrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

export function isPrismaError(value: unknown): value is PrismaError {
  return (
    isError(value) &&
    'code' in value &&
    typeof (value as PrismaError).code === 'string' &&
    (value as PrismaError).code.startsWith('P')
  );
}

/**
 * Type guard for Redis errors
 */
export function isRedisError(value: unknown): value is Error & { code?: string } {
  return isError(value) && value.name === 'Error' && 'code' in value;
}
```

#### 3.2 Use type guards instead of assertions

**Current (problematic):**
```typescript
} catch (error) {
  const err = error as Error;
  logger.error({ err }, err.message);
}
```

**Improved:**
```typescript
import { isError, isSystemError } from '../utils/typeGuards.js';

} catch (error) {
  if (isSystemError(error)) {
    logger.error({ err: error, code: error.code }, error.message);
  } else if (isError(error)) {
    logger.error({ err: error }, error.message);
  } else {
    logger.error({ error }, 'Unknown error type');
  }
}
```

---

### Phase 4: Request/Response Type Safety

**Priority: MEDIUM**

#### 4.1 Create typed request handlers

**File: `packages/service/src/types/express.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Typed request with validated body
 */
export interface TypedRequest<TBody = unknown, TParams = unknown, TQuery = unknown>
  extends Request {
  body: TBody;
  params: TParams;
  query: TQuery;
}

/**
 * Typed response with JSON method constrained to specific type
 */
export interface TypedResponse<TData = unknown> extends Response {
  json: (data: TData) => this;
}

/**
 * Create a typed request handler with schema validation
 */
export function createTypedHandler<
  TBody,
  TParams,
  TQuery,
  TResponse
>(config: {
  bodySchema?: ZodSchema<TBody>;
  paramsSchema?: ZodSchema<TParams>;
  querySchema?: ZodSchema<TQuery>;
  handler: (
    req: TypedRequest<TBody, TParams, TQuery>,
    res: TypedResponse<TResponse>
  ) => Promise<void>;
}): (req: Request, res: Response, next: NextFunction) => void {
  return async (req, res, next) => {
    try {
      const typedReq = req as TypedRequest<TBody, TParams, TQuery>;

      if (config.bodySchema) {
        typedReq.body = config.bodySchema.parse(req.body);
      }
      if (config.paramsSchema) {
        typedReq.params = config.paramsSchema.parse(req.params);
      }
      if (config.querySchema) {
        typedReq.query = config.querySchema.parse(req.query);
      }

      await config.handler(typedReq, res as TypedResponse<TResponse>);
    } catch (error) {
      next(error);
    }
  };
}
```

#### 4.2 Example usage in routes

```typescript
import { createTypedHandler } from '../types/express.js';
import { streamNameSchema, messageSchema } from '../schemas/streams.js';

const postMessageHandler = createTypedHandler({
  bodySchema: z.object({
    streamName: streamNameSchema,
    message: messageSchema,
  }),
  handler: async (req, res) => {
    // req.body is now typed as { streamName: string; message: Message }
    const { streamName, message } = req.body;

    // ... handle message

    res.json({ success: true, messageId });
  },
});

router.post('/message', postMessageHandler);
```

---

### Phase 5: Stream Message Type Safety

**Priority: HIGH**

#### 5.1 Create stream message types

**File: `packages/service/src/types/streams.ts`**

```typescript
import { z } from 'zod';

/**
 * Redis stream entry structure
 */
export interface StreamEntry {
  id: string;
  message: Record<string, string>;
}

/**
 * Parsed stream message with timestamp
 */
export interface ParsedStreamMessage {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Stream metadata
 */
export interface StreamMetadata {
  name: string;
  length: number;
  firstEntry: string | null;
  lastEntry: string | null;
  createdAt?: Date;
}

/**
 * Schema for validating stream message data
 */
export const streamMessageDataSchema = z.record(z.unknown());

/**
 * Parse a Redis stream ID to extract timestamp
 */
export function parseStreamId(id: string): { timestamp: number; sequence: number } {
  const parts = id.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid stream ID format: ${id}`);
  }

  const timestamp = parseInt(parts[0], 10);
  const sequence = parseInt(parts[1], 10);

  if (Number.isNaN(timestamp) || Number.isNaN(sequence)) {
    throw new Error(`Invalid stream ID values: ${id}`);
  }

  return { timestamp, sequence };
}

/**
 * Type-safe stream ID validation
 */
export function isValidStreamId(id: unknown): id is string {
  if (typeof id !== 'string') return false;

  const parts = id.split('-');
  if (parts.length !== 2) return false;

  const timestamp = parseInt(parts[0], 10);
  const sequence = parseInt(parts[1], 10);

  return !Number.isNaN(timestamp) && !Number.isNaN(sequence);
}
```

#### 5.2 Fix stream cursor initialization

**Current (problematic):**
```typescript
// line 414 in streams.ts
lastId = Date.now().toString();  // Not a valid Redis stream ID!
```

**Fixed:**
```typescript
// Use '$' for "latest message" or get actual last ID
lastId = '$';  // Start from latest

// Or, if you need to start from a specific time:
lastId = `${Date.now()}-0`;  // Valid Redis stream ID format
```

---

### Phase 6: Database Types

**Priority: MEDIUM**

#### 6.1 Create Prisma type extensions

**File: `packages/service/src/types/prisma.ts`**

```typescript
import { Prisma, Workout } from '@prisma/client';
import { TelemetryArray, WorkoutSummary, WorkoutSettings } from '../schemas/workout.js';

/**
 * Workout with parsed JSON fields
 */
export interface WorkoutWithParsedFields extends Omit<Workout, 'telemetry' | 'summary' | 'settings'> {
  telemetry: TelemetryArray | null;
  summary: WorkoutSummary | null;
  settings: WorkoutSettings | null;
}

/**
 * Transform database workout to typed workout
 */
export function toTypedWorkout(workout: Workout): WorkoutWithParsedFields {
  return {
    ...workout,
    telemetry: workout.telemetry
      ? safeJsonParseOrNull(workout.telemetry, telemetryArraySchema)
      : null,
    summary: workout.summary
      ? safeJsonParseOrNull(workout.summary, workoutSummarySchema)
      : null,
    settings: workout.settings
      ? safeJsonParseOrNull(workout.settings, workoutSettingsSchema)
      : null,
  };
}

/**
 * Prepare typed workout for database storage
 */
export function toDatabaseWorkout(
  workout: Partial<WorkoutWithParsedFields>
): Prisma.WorkoutUpdateInput {
  return {
    ...workout,
    telemetry: workout.telemetry ? JSON.stringify(workout.telemetry) : undefined,
    summary: workout.summary ? JSON.stringify(workout.summary) : undefined,
    settings: workout.settings ? JSON.stringify(workout.settings) : undefined,
  };
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/service/src/utils/typeGuards.ts` | Type guard functions |
| `packages/service/src/utils/safeJson.ts` | Safe JSON parsing utilities |
| `packages/service/src/schemas/workout.ts` | Zod schemas for workout data |
| `packages/service/src/types/express.ts` | Typed Express handlers |
| `packages/service/src/types/streams.ts` | Stream type definitions |
| `packages/service/src/types/prisma.ts` | Prisma type extensions |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/service/src/routes/streams.ts` | Use typed handlers, fix stream ID |
| `packages/service/src/routes/workouts.ts` | Use typed handlers, safe JSON |
| `packages/service/src/db/workoutService.ts` | Use safe JSON parsing |
| `.eslintrc.js` / `eslint.config.js` | Add strict TypeScript rules |

---

## Testing Requirements

### Unit Tests
- All type guards return correct boolean for valid/invalid inputs
- Safe JSON parsers handle malformed JSON gracefully
- Schema validation catches invalid data structures
- Stream ID parsing handles edge cases

### Integration Tests
- Typed handlers validate request bodies correctly
- Database operations preserve type safety through round-trip
- Error handlers use type guards correctly

### Type Tests (compile-time)
- TypeScript compilation catches invalid type usage
- No `any` types slip through
- Zod inferred types match expected shapes

---

## Migration Strategy

1. **Add new utilities first** without modifying existing code
2. **Update one route at a time**, starting with least-used endpoints
3. **Run full test suite** after each file modification
4. **Enable strict ESLint rules** only after all violations fixed

---

## Success Metrics

1. **Zero `any` types** in production code
2. **100% Zod validation** on all JSON parsing
3. **No type assertions** without prior type guards
4. **ESLint strict mode** passing with no warnings
5. **Zero runtime type errors** in production logs

---

## Estimated Effort

- Phase 1: 1-2 hours (audit and eliminate any)
- Phase 2: 3-4 hours (JSON parsing safety)
- Phase 3: 2-3 hours (error type guards)
- Phase 4: 2-3 hours (request/response types)
- Phase 5: 2-3 hours (stream types)
- Phase 6: 2-3 hours (database types)

**Total: 12-18 hours**
