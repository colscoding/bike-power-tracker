# Error Handling Improvements Plan

## Overview

This plan addresses inconsistencies in error handling across the service package and proposes a unified approach that leverages the existing custom error classes while improving error context preservation and edge case handling.

## Current State Assessment

### Strengths
- Centralized error handler middleware in `packages/service/src/middleware/errorHandler.ts`
- Custom error hierarchy: `AppError`, `ValidationError`, `NotFoundError`, `StreamError`, `AuthError`
- Zod integration for schema validation with proper error mapping
- Comprehensive logging with Pino

### Issues Identified

1. **Inconsistent error handling in streams.ts** (lines 88-92, 436-440, etc.)
   - Routes use inline try-catch with `as Error` assertions
   - Error context lost when re-throwing or logging

2. **Missing error context** in stream operations
   - Stream cleanup errors logged but not tracked
   - Blocking client disconnection errors silently swallowed

3. **Race conditions** leading to unhandled edge cases
   - Stream could be deleted between existence check and read operation
   - Response could close between `res.destroyed` check and write

---

## Implementation Plan

### Phase 1: Standardize Route Error Handling

**Priority: HIGH**

#### 1.1 Create async route wrapper utility

**File:** `packages/service/src/utils/asyncHandler.ts`

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to ensure errors are passed to Express error middleware.
 * Eliminates need for try-catch blocks in individual routes.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

#### 1.2 Refactor streams.ts routes to use wrapper

**Current (problematic):**
```typescript
router.post('/message', async (req, res) => {
  try {
    // ... logic
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
```

**Proposed:**
```typescript
router.post('/message', asyncHandler(async (req, res) => {
  // ... logic
  // Errors automatically flow to error handler middleware
}));
```

#### 1.3 Files to update
- `packages/service/src/routes/streams.ts` - 6 route handlers
- `packages/service/src/routes/workouts.ts` - 5 route handlers
- `packages/service/src/routes/auth.ts` - 2 route handlers

---

### Phase 2: Enhance Custom Error Classes

**Priority: HIGH**

#### 2.1 Add error cause chain support

**File:** `packages/service/src/errors.ts`

Add `cause` property to preserve original error context:

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly cause?: Error;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.cause = cause;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}
```

#### 2.2 Create specialized stream errors

```typescript
export class StreamNotFoundError extends AppError {
  constructor(streamName: string, cause?: Error) {
    super(`Stream '${streamName}' not found`, 404, true, cause, { streamName });
  }
}

export class StreamOperationError extends AppError {
  constructor(operation: string, streamName: string, cause?: Error) {
    super(
      `Failed to ${operation} on stream '${streamName}'`,
      500,
      true,
      cause,
      { operation, streamName }
    );
  }
}

export class StreamRaceConditionError extends AppError {
  constructor(streamName: string, operation: string) {
    super(
      `Stream '${streamName}' was modified during ${operation}`,
      409, // Conflict
      true,
      undefined,
      { streamName, operation }
    );
  }
}
```

#### 2.3 Create connection-related errors

```typescript
export class ConnectionError extends AppError {
  constructor(service: string, cause?: Error) {
    super(`Connection to ${service} failed`, 503, true, cause, { service });
  }
}

export class PoolExhaustedError extends AppError {
  constructor(poolName: string, maxConnections: number) {
    super(
      `Connection pool '${poolName}' exhausted (max: ${maxConnections})`,
      503,
      true,
      undefined,
      { poolName, maxConnections }
    );
  }
}
```

---

### Phase 3: Improve Error Handler Middleware

**Priority: MEDIUM**

#### 3.1 Enhance error logging with context

**File:** `packages/service/src/middleware/errorHandler.ts`

```typescript
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestContext = {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (err instanceof AppError) {
      logger.error({
        err,
        cause: err.cause,
        context: err.context,
        request: requestContext,
        isOperational: err.isOperational,
      }, err.message);

      return res.status(err.statusCode).json({
        error: err.message,
        code: err.constructor.name,
        ...(process.env.NODE_ENV === 'development' && {
          context: err.context,
          stack: err.stack,
        }),
      });
    }

    // Unexpected errors
    logger.error({
      err,
      request: requestContext,
      isOperational: false,
    }, 'Unexpected error');

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  };
}
```

---

### Phase 4: Handle Race Conditions in SSE

**Priority: CRITICAL**

#### 4.1 Safe response write utility

**File:** `packages/service/src/utils/sse.ts`

```typescript
import { Response } from 'express';

/**
 * Safely writes SSE data, handling race conditions where
 * the response may close between check and write.
 */
export function safeSSEWrite(res: Response, data: string): boolean {
  if (res.destroyed || res.writableEnded) {
    return false;
  }

  try {
    res.write(data);
    return true;
  } catch (error) {
    // Response was closed between check and write
    return false;
  }
}

/**
 * Wraps SSE response with safe write methods
 */
export function createSSEWriter(res: Response) {
  return {
    writeEvent(event: string, data: unknown): boolean {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      return safeSSEWrite(res, message);
    },

    writeData(data: unknown): boolean {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      return safeSSEWrite(res, message);
    },

    writeComment(comment: string): boolean {
      return safeSSEWrite(res, `: ${comment}\n\n`);
    },

    isWritable(): boolean {
      return !res.destroyed && !res.writableEnded;
    }
  };
}
```

#### 4.2 Apply to streams.ts polling loops

Update poll and listenAll endpoints to use `safeSSEWrite`:

```typescript
// In poll loop
const writer = createSSEWriter(res);

while (writer.isWritable()) {
  // ... fetch messages

  if (!writer.writeData(messages)) {
    logger.debug({ streamName }, 'Client disconnected during write');
    break;
  }
}
```

---

### Phase 5: Stream Operation Atomicity

**Priority: HIGH**

#### 5.1 Atomic stream operations with retry

**File:** `packages/service/src/utils/redisOperations.ts`

```typescript
import { RedisClientType } from 'redis';
import { StreamRaceConditionError } from '../errors.js';

const MAX_RETRIES = 3;

/**
 * Performs a read operation on a stream with race condition handling.
 * Retries if stream is modified during operation.
 */
export async function safeStreamRead(
  redis: RedisClientType,
  streamName: string,
  options: { start?: string; end?: string; count?: number }
): Promise<StreamEntry[] | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const exists = await redis.exists(streamName);
    if (!exists) {
      return null;
    }

    try {
      const result = await redis.xRange(
        streamName,
        options.start ?? '-',
        options.end ?? '+',
        { COUNT: options.count }
      );
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('no such key')) {
        // Stream was deleted between exists check and read
        if (attempt < MAX_RETRIES - 1) {
          continue; // Retry
        }
        return null; // Give up after retries
      }
      throw error;
    }
  }

  throw new StreamRaceConditionError(streamName, 'read');
}
```

---

### Phase 6: Error Tracking and Monitoring

**Priority: MEDIUM**

#### 6.1 Create error metrics collector

**File:** `packages/service/src/monitoring/errorMetrics.ts`

```typescript
interface ErrorMetric {
  errorType: string;
  count: number;
  lastOccurred: Date;
  samples: Array<{
    message: string;
    context?: Record<string, unknown>;
    timestamp: Date;
  }>;
}

class ErrorMetricsCollector {
  private metrics: Map<string, ErrorMetric> = new Map();
  private readonly maxSamples = 10;

  record(error: Error): void {
    const errorType = error.constructor.name;
    const existing = this.metrics.get(errorType);

    const sample = {
      message: error.message,
      context: error instanceof AppError ? error.context : undefined,
      timestamp: new Date(),
    };

    if (existing) {
      existing.count++;
      existing.lastOccurred = new Date();
      existing.samples.push(sample);
      if (existing.samples.length > this.maxSamples) {
        existing.samples.shift();
      }
    } else {
      this.metrics.set(errorType, {
        errorType,
        count: 1,
        lastOccurred: new Date(),
        samples: [sample],
      });
    }
  }

  getMetrics(): ErrorMetric[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }
}

export const errorMetrics = new ErrorMetricsCollector();
```

#### 6.2 Add metrics endpoint

**File:** `packages/service/src/routes/health.ts`

```typescript
router.get('/metrics/errors', (req, res) => {
  res.json({
    errors: errorMetrics.getMetrics(),
    timestamp: new Date().toISOString(),
  });
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/service/src/errors.ts` | Add cause chain, context, specialized errors |
| `packages/service/src/utils/asyncHandler.ts` | NEW - Async route wrapper |
| `packages/service/src/utils/sse.ts` | NEW - Safe SSE write utilities |
| `packages/service/src/utils/redisOperations.ts` | NEW - Atomic stream operations |
| `packages/service/src/routes/streams.ts` | Use asyncHandler, safe writes |
| `packages/service/src/routes/workouts.ts` | Use asyncHandler |
| `packages/service/src/routes/auth.ts` | Use asyncHandler |
| `packages/service/src/middleware/errorHandler.ts` | Enhanced logging, context |
| `packages/service/src/monitoring/errorMetrics.ts` | NEW - Error tracking |

---

## Testing Requirements

### Unit Tests
- `asyncHandler` correctly forwards errors to next()
- Custom error classes preserve cause chain
- `safeSSEWrite` handles closed responses
- `safeStreamRead` retries on race conditions

### Integration Tests
- Error handler returns correct status codes and formats
- SSE endpoints handle client disconnection gracefully
- Stream operations recover from race conditions

### Edge Case Tests
- Response closes mid-write
- Stream deleted during read
- Pool exhaustion during request
- Chained error cause preservation

---

## Success Metrics

1. **Zero unhandled promise rejections** in production logs
2. **Consistent error response format** across all endpoints
3. **Error context preserved** through the entire chain
4. **No SSE write errors** due to race conditions
5. **Error type distribution** visible via metrics endpoint

---

## Estimated Effort

- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 1-2 hours
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours
- Phase 6: 1-2 hours

**Total: 10-16 hours**
