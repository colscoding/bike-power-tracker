# Performance and Connection Management Plan

## Overview

This plan addresses performance bottlenecks and connection management issues identified in the codebase, focusing on Redis operations, SSE connection scaling, and overall system efficiency.

## Current State Assessment

### Strengths
- Sophisticated Redis connection pool with health checks
- Stream registry caching (30-second refresh)
- Batch processing for type checks (20-key batches)
- Promise.all for parallel operations
- Graceful shutdown with connection tracking

### Issues Identified

1. **Blocking client pool exhaustion** - Each SSE listener creates a new Redis connection
2. **SCAN command inefficiency** - Full SCAN every request to list streams
3. **Stream metadata operations** - 3 separate Redis calls per stream
4. **Hardcoded pool configuration** - No environment variable control
5. **Normalized power calculation** - O(n) with multiple allocations for large datasets

---

## Implementation Plan

### Phase 1: SSE Connection Pooling

**Priority: CRITICAL**

#### 1.1 Create dedicated blocking client pool

**File: `packages/service/src/redis/blockingPool.ts`**

```typescript
import { createClient, RedisClientType } from 'redis';
import { logger } from '../logger.js';

interface BlockingClient {
  client: RedisClientType;
  inUse: boolean;
  lastUsed: number;
  id: string;
}

interface BlockingPoolConfig {
  redisUrl: string;
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
}

const DEFAULT_CONFIG: BlockingPoolConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  minConnections: parseInt(process.env.BLOCKING_POOL_MIN || '5', 10),
  maxConnections: parseInt(process.env.BLOCKING_POOL_MAX || '50', 10),
  acquireTimeout: parseInt(process.env.BLOCKING_POOL_ACQUIRE_TIMEOUT || '5000', 10),
  idleTimeout: parseInt(process.env.BLOCKING_POOL_IDLE_TIMEOUT || '60000', 10),
};

export class BlockingClientPool {
  private clients: Map<string, BlockingClient> = new Map();
  private waitQueue: Array<{
    resolve: (client: BlockingClient) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private config: BlockingPoolConfig;
  private isShuttingDown = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BlockingPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    // Pre-create minimum connections
    const promises = Array.from(
      { length: this.config.minConnections },
      () => this.createClient()
    );
    await Promise.all(promises);

    // Start cleanup interval for idle connections
    this.cleanupInterval = setInterval(
      () => this.cleanupIdleConnections(),
      this.config.idleTimeout / 2
    );

    logger.info(
      { min: this.config.minConnections, max: this.config.maxConnections },
      'Blocking client pool initialized'
    );
  }

  private async createClient(): Promise<BlockingClient> {
    const id = `blocking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const client = createClient({ url: this.config.redisUrl });

    client.on('error', (err) => {
      logger.error({ err, clientId: id }, 'Blocking client error');
    });

    await client.connect();

    const blockingClient: BlockingClient = {
      client: client as RedisClientType,
      inUse: false,
      lastUsed: Date.now(),
      id,
    };

    this.clients.set(id, blockingClient);
    return blockingClient;
  }

  async acquire(): Promise<{ client: RedisClientType; release: () => void }> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    // Try to find an available client
    for (const [, blockingClient] of this.clients) {
      if (!blockingClient.inUse) {
        blockingClient.inUse = true;
        blockingClient.lastUsed = Date.now();
        return {
          client: blockingClient.client,
          release: () => this.release(blockingClient.id),
        };
      }
    }

    // Create new client if under max
    if (this.clients.size < this.config.maxConnections) {
      const blockingClient = await this.createClient();
      blockingClient.inUse = true;
      return {
        client: blockingClient.client,
        release: () => this.release(blockingClient.id),
      };
    }

    // Wait for available client
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex((w) => w.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Acquire timeout - pool exhausted'));
      }, this.config.acquireTimeout);

      this.waitQueue.push({
        resolve: (blockingClient) => {
          clearTimeout(timeout);
          resolve({
            client: blockingClient.client,
            release: () => this.release(blockingClient.id),
          });
        },
        reject,
        timeout,
      });
    });
  }

  private release(id: string): void {
    const blockingClient = this.clients.get(id);
    if (!blockingClient) return;

    blockingClient.inUse = false;
    blockingClient.lastUsed = Date.now();

    // Check if someone is waiting
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      blockingClient.inUse = true;
      waiter.resolve(blockingClient);
    }
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, blockingClient] of this.clients) {
      if (
        !blockingClient.inUse &&
        now - blockingClient.lastUsed > this.config.idleTimeout &&
        this.clients.size > this.config.minConnections
      ) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const blockingClient = this.clients.get(id);
      if (blockingClient) {
        this.clients.delete(id);
        try {
          await blockingClient.client.quit();
        } catch (error) {
          logger.warn({ error, clientId: id }, 'Error closing idle client');
        }
      }
    }

    if (toRemove.length > 0) {
      logger.debug(
        { removed: toRemove.length, remaining: this.clients.size },
        'Cleaned up idle blocking clients'
      );
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiters
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool is shutting down'));
    }
    this.waitQueue = [];

    // Close all clients
    const closePromises = Array.from(this.clients.values()).map(
      async (blockingClient) => {
        try {
          await blockingClient.client.quit();
        } catch (error) {
          logger.warn({ error, clientId: blockingClient.id }, 'Error closing client');
        }
      }
    );

    await Promise.all(closePromises);
    this.clients.clear();

    logger.info('Blocking client pool shut down');
  }

  getStats(): {
    total: number;
    inUse: number;
    available: number;
    waiting: number;
  } {
    let inUse = 0;
    for (const client of this.clients.values()) {
      if (client.inUse) inUse++;
    }
    return {
      total: this.clients.size,
      inUse,
      available: this.clients.size - inUse,
      waiting: this.waitQueue.length,
    };
  }
}

export const blockingPool = new BlockingClientPool();
```

#### 1.2 Update streams.ts to use blocking pool

**File: `packages/service/src/routes/streams.ts`**

```typescript
import { blockingPool } from '../redis/blockingPool.js';

// Replace current blocking client creation:

// Current:
// const blockingClient = redis.duplicate();
// await blockingClient.connect();

// New:
const { client: blockingClient, release } = await blockingPool.acquire();

try {
  // Use blockingClient for XREAD
} finally {
  release();
}
```

---

### Phase 2: Redis Operation Optimization

**Priority: HIGH**

#### 2.1 Use cached stream registry for listing

**File: `packages/service/src/routes/streams.ts`**

```typescript
// Current (inefficient - SCAN every request):
router.get('/', async (req, res) => {
  const keys: string[] = [];
  for await (const key of redis.scanIterator({ MATCH: 'stream:*' })) {
    keys.push(key);
  }
  // ...
});

// Improved (use cache):
import { streamRegistry } from '../redis/streamRegistry.js';

router.get('/', async (req, res) => {
  const streams = await streamRegistry.getStreams();
  // ...
});
```

#### 2.2 Pipeline stream metadata operations

**File: `packages/service/src/redis/streamOperations.ts`**

```typescript
import { RedisClientType } from 'redis';

interface StreamInfo {
  name: string;
  length: number;
  firstEntry: string | null;
  lastEntry: string | null;
}

/**
 * Get metadata for multiple streams using pipelining
 */
export async function getStreamInfoBatch(
  redis: RedisClientType,
  streamNames: string[]
): Promise<Map<string, StreamInfo>> {
  if (streamNames.length === 0) {
    return new Map();
  }

  const multi = redis.multi();

  for (const name of streamNames) {
    multi.xLen(name);
    multi.xRange(name, '-', '+', { COUNT: 1 });
    multi.xRevRange(name, '+', '-', { COUNT: 1 });
  }

  const results = await multi.exec();
  const infoMap = new Map<string, StreamInfo>();

  for (let i = 0; i < streamNames.length; i++) {
    const baseIndex = i * 3;
    const length = results[baseIndex] as number;
    const firstEntries = results[baseIndex + 1] as Array<{ id: string }>;
    const lastEntries = results[baseIndex + 2] as Array<{ id: string }>;

    infoMap.set(streamNames[i], {
      name: streamNames[i],
      length,
      firstEntry: firstEntries[0]?.id ?? null,
      lastEntry: lastEntries[0]?.id ?? null,
    });
  }

  return infoMap;
}

/**
 * Delete multiple streams atomically
 */
export async function deleteStreamsBatch(
  redis: RedisClientType,
  streamNames: string[]
): Promise<number> {
  if (streamNames.length === 0) return 0;

  const multi = redis.multi();
  for (const name of streamNames) {
    multi.del(name);
  }

  const results = await multi.exec();
  return results.reduce((sum, result) => sum + (result as number), 0);
}

/**
 * Check existence of multiple streams
 */
export async function checkStreamsExist(
  redis: RedisClientType,
  streamNames: string[]
): Promise<Map<string, boolean>> {
  if (streamNames.length === 0) {
    return new Map();
  }

  const multi = redis.multi();
  for (const name of streamNames) {
    multi.exists(name);
  }

  const results = await multi.exec();
  const existsMap = new Map<string, boolean>();

  for (let i = 0; i < streamNames.length; i++) {
    existsMap.set(streamNames[i], (results[i] as number) === 1);
  }

  return existsMap;
}
```

#### 2.3 Implement Lua script for atomic operations

**File: `packages/service/src/redis/scripts.ts`**

```typescript
import { RedisClientType } from 'redis';

/**
 * Lua script to get stream info atomically
 */
const GET_STREAM_INFO_SCRIPT = `
local streamName = KEYS[1]
local exists = redis.call('EXISTS', streamName)
if exists == 0 then
  return nil
end

local length = redis.call('XLEN', streamName)
local first = redis.call('XRANGE', streamName, '-', '+', 'COUNT', 1)
local last = redis.call('XREVRANGE', streamName, '+', '-', 'COUNT', 1)

local firstId = nil
local lastId = nil

if #first > 0 then
  firstId = first[1][1]
end

if #last > 0 then
  lastId = last[1][1]
end

return {length, firstId, lastId}
`;

/**
 * Lua script to safely read from stream with existence check
 */
const SAFE_STREAM_READ_SCRIPT = `
local streamName = KEYS[1]
local start = ARGV[1]
local stop = ARGV[2]
local count = tonumber(ARGV[3])

local exists = redis.call('EXISTS', streamName)
if exists == 0 then
  return nil
end

if count then
  return redis.call('XRANGE', streamName, start, stop, 'COUNT', count)
else
  return redis.call('XRANGE', streamName, start, stop)
end
`;

export class RedisScripts {
  private redis: RedisClientType;
  private scriptShas: Map<string, string> = new Map();

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  async initialize(): Promise<void> {
    // Load scripts and cache their SHA
    const getInfoSha = await this.redis.scriptLoad(GET_STREAM_INFO_SCRIPT);
    this.scriptShas.set('getStreamInfo', getInfoSha);

    const safeReadSha = await this.redis.scriptLoad(SAFE_STREAM_READ_SCRIPT);
    this.scriptShas.set('safeStreamRead', safeReadSha);
  }

  async getStreamInfo(
    streamName: string
  ): Promise<{ length: number; firstId: string | null; lastId: string | null } | null> {
    const sha = this.scriptShas.get('getStreamInfo');
    if (!sha) throw new Error('Scripts not initialized');

    const result = await this.redis.evalSha(sha, {
      keys: [streamName],
    }) as [number, string | null, string | null] | null;

    if (result === null) return null;

    return {
      length: result[0],
      firstId: result[1],
      lastId: result[2],
    };
  }

  async safeStreamRead(
    streamName: string,
    start: string,
    stop: string,
    count?: number
  ): Promise<Array<{ id: string; message: Record<string, string> }> | null> {
    const sha = this.scriptShas.get('safeStreamRead');
    if (!sha) throw new Error('Scripts not initialized');

    const result = await this.redis.evalSha(sha, {
      keys: [streamName],
      arguments: [start, stop, count?.toString() ?? ''],
    });

    return result as Array<{ id: string; message: Record<string, string> }> | null;
  }
}
```

---

### Phase 3: Environment-Controlled Configuration

**Priority: MEDIUM**

#### 3.1 Create comprehensive config module

**File: `packages/service/src/config/redis.ts`**

```typescript
export interface RedisPoolConfig {
  url: string;
  // Main pool
  poolMinConnections: number;
  poolMaxConnections: number;
  poolAcquireTimeout: number;
  poolIdleTimeout: number;
  poolHealthCheckInterval: number;
  // Blocking pool (for SSE)
  blockingPoolMinConnections: number;
  blockingPoolMaxConnections: number;
  blockingPoolAcquireTimeout: number;
  blockingPoolIdleTimeout: number;
  // Stream registry
  registryRefreshInterval: number;
  registryCacheExpiry: number;
}

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    console.warn(`Invalid integer for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export const redisConfig: RedisPoolConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',

  // Main pool
  poolMinConnections: parseIntEnv('REDIS_POOL_MIN', 2),
  poolMaxConnections: parseIntEnv('REDIS_POOL_MAX', 10),
  poolAcquireTimeout: parseIntEnv('REDIS_POOL_ACQUIRE_TIMEOUT', 5000),
  poolIdleTimeout: parseIntEnv('REDIS_POOL_IDLE_TIMEOUT', 30000),
  poolHealthCheckInterval: parseIntEnv('REDIS_POOL_HEALTH_CHECK_INTERVAL', 15000),

  // Blocking pool
  blockingPoolMinConnections: parseIntEnv('REDIS_BLOCKING_POOL_MIN', 5),
  blockingPoolMaxConnections: parseIntEnv('REDIS_BLOCKING_POOL_MAX', 50),
  blockingPoolAcquireTimeout: parseIntEnv('REDIS_BLOCKING_POOL_ACQUIRE_TIMEOUT', 5000),
  blockingPoolIdleTimeout: parseIntEnv('REDIS_BLOCKING_POOL_IDLE_TIMEOUT', 60000),

  // Stream registry
  registryRefreshInterval: parseIntEnv('REDIS_REGISTRY_REFRESH_INTERVAL', 30000),
  registryCacheExpiry: parseIntEnv('REDIS_REGISTRY_CACHE_EXPIRY', 60000),
};

export function logRedisConfig(): void {
  console.log('Redis configuration:', {
    url: redisConfig.url.replace(/\/\/.*@/, '//<redacted>@'),
    mainPool: {
      min: redisConfig.poolMinConnections,
      max: redisConfig.poolMaxConnections,
    },
    blockingPool: {
      min: redisConfig.blockingPoolMinConnections,
      max: redisConfig.blockingPoolMaxConnections,
    },
  });
}
```

---

### Phase 4: Normalized Power Calculation Optimization

**Priority: LOW**

#### 4.1 Optimize calculation algorithm

**File: `packages/service/src/db/workoutService.ts`**

```typescript
/**
 * Calculate normalized power with optimized memory usage
 * Uses a sliding window approach instead of creating intermediate arrays
 */
export function calculateNormalizedPower(
  telemetry: TelemetryPoint[],
  windowSize = 30
): number | null {
  if (telemetry.length < windowSize) return null;

  // Extract power values, filtering out undefined
  const powerValues: number[] = [];
  for (const point of telemetry) {
    if (point.power !== undefined && point.power !== null) {
      powerValues.push(point.power);
    }
  }

  if (powerValues.length < windowSize) return null;

  // Calculate rolling averages using sliding window
  // Avoid creating new arrays for each window
  let windowSum = 0;
  let count = 0;
  let sumOfFourthPowers = 0;

  // Initialize first window
  for (let i = 0; i < windowSize; i++) {
    windowSum += powerValues[i];
  }

  // Process windows
  for (let i = windowSize; i <= powerValues.length; i++) {
    const windowAvg = windowSum / windowSize;
    const fourthPower = windowAvg ** 4;
    sumOfFourthPowers += fourthPower;
    count++;

    // Slide window
    if (i < powerValues.length) {
      windowSum = windowSum - powerValues[i - windowSize] + powerValues[i];
    }
  }

  if (count === 0) return null;

  // Fourth root of average of fourth powers
  return Math.pow(sumOfFourthPowers / count, 0.25);
}

/**
 * For very large datasets, use streaming calculation
 */
export function* streamNormalizedPowerCalculation(
  telemetryIterator: Iterable<TelemetryPoint>,
  windowSize = 30
): Generator<{ progress: number; partialNP: number }, number | null, void> {
  const window: number[] = [];
  let sumOfFourthPowers = 0;
  let count = 0;
  let total = 0;

  for (const point of telemetryIterator) {
    total++;

    if (point.power === undefined || point.power === null) continue;

    window.push(point.power);

    if (window.length === windowSize) {
      const avg = window.reduce((a, b) => a + b, 0) / windowSize;
      sumOfFourthPowers += avg ** 4;
      count++;
      window.shift();

      // Yield progress periodically
      if (count % 1000 === 0) {
        yield {
          progress: total,
          partialNP: Math.pow(sumOfFourthPowers / count, 0.25),
        };
      }
    }
  }

  if (count === 0) return null;
  return Math.pow(sumOfFourthPowers / count, 0.25);
}
```

---

### Phase 5: Monitoring and Metrics

**Priority: MEDIUM**

#### 5.1 Create performance metrics collector

**File: `packages/service/src/monitoring/metrics.ts`**

```typescript
interface OperationMetric {
  name: string;
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p95Duration: number;
  recentDurations: number[];
}

class PerformanceMetrics {
  private metrics: Map<string, OperationMetric> = new Map();
  private readonly maxRecentSamples = 100;

  recordOperation(name: string, durationMs: number): void {
    const existing = this.metrics.get(name);

    if (existing) {
      existing.count++;
      existing.totalDuration += durationMs;
      existing.minDuration = Math.min(existing.minDuration, durationMs);
      existing.maxDuration = Math.max(existing.maxDuration, durationMs);
      existing.avgDuration = existing.totalDuration / existing.count;

      existing.recentDurations.push(durationMs);
      if (existing.recentDurations.length > this.maxRecentSamples) {
        existing.recentDurations.shift();
      }

      existing.p95Duration = this.calculateP95(existing.recentDurations);
    } else {
      this.metrics.set(name, {
        name,
        count: 1,
        totalDuration: durationMs,
        minDuration: durationMs,
        maxDuration: durationMs,
        avgDuration: durationMs,
        p95Duration: durationMs,
        recentDurations: [durationMs],
      });
    }
  }

  private calculateP95(durations: number[]): number {
    if (durations.length === 0) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  getMetrics(): OperationMetric[] {
    return Array.from(this.metrics.values()).map((m) => ({
      ...m,
      recentDurations: [], // Don't expose raw data
    }));
  }

  clear(): void {
    this.metrics.clear();
  }
}

export const performanceMetrics = new PerformanceMetrics();

/**
 * Decorator to time an async function
 */
export function timed<T extends (...args: unknown[]) => Promise<unknown>>(
  operationName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const start = performance.now();
    try {
      return await fn(...args);
    } finally {
      const duration = performance.now() - start;
      performanceMetrics.recordOperation(operationName, duration);
    }
  }) as T;
}
```

#### 5.2 Add metrics endpoint

**File: `packages/service/src/routes/health.ts`**

```typescript
import { blockingPool } from '../redis/blockingPool.js';
import { performanceMetrics } from '../monitoring/metrics.js';

router.get('/metrics', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    blockingPool: blockingPool.getStats(),
    operations: performanceMetrics.getMetrics(),
  });
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/service/src/redis/blockingPool.ts` | SSE connection pooling |
| `packages/service/src/redis/streamOperations.ts` | Pipelined stream operations |
| `packages/service/src/redis/scripts.ts` | Lua scripts for atomic ops |
| `packages/service/src/config/redis.ts` | Environment-controlled config |
| `packages/service/src/monitoring/metrics.ts` | Performance metrics |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/service/src/routes/streams.ts` | Use blocking pool, cached registry |
| `packages/service/src/redis.ts` | Use config module |
| `packages/service/src/db/workoutService.ts` | Optimize NP calculation |
| `packages/service/src/routes/health.ts` | Add metrics endpoint |

---

## Testing Requirements

### Unit Tests
- Blocking pool respects min/max connections
- Pool acquisition timeout works correctly
- Pipelined operations return correct results
- Lua scripts handle edge cases

### Load Tests
- 100 concurrent SSE connections
- 1000 requests/second to stream list endpoint
- Pool exhaustion recovery

### Integration Tests
- Blocking pool shutdown cleans up all connections
- Metrics accurately reflect operation timing
- Config changes apply correctly

---

## Environment Variables

```bash
# Main Redis Pool
REDIS_URL=redis://localhost:6379
REDIS_POOL_MIN=2
REDIS_POOL_MAX=10
REDIS_POOL_ACQUIRE_TIMEOUT=5000
REDIS_POOL_IDLE_TIMEOUT=30000
REDIS_POOL_HEALTH_CHECK_INTERVAL=15000

# Blocking Pool (SSE)
REDIS_BLOCKING_POOL_MIN=5
REDIS_BLOCKING_POOL_MAX=50
REDIS_BLOCKING_POOL_ACQUIRE_TIMEOUT=5000
REDIS_BLOCKING_POOL_IDLE_TIMEOUT=60000

# Stream Registry
REDIS_REGISTRY_REFRESH_INTERVAL=30000
REDIS_REGISTRY_CACHE_EXPIRY=60000
```

---

## Success Metrics

1. **SSE connection limit** increased from ~100 to ~1000+ concurrent
2. **Stream list latency** reduced by 50%+ (cached vs SCAN)
3. **Stream metadata calls** reduced from 3 to 1 per stream
4. **Memory usage stable** under high connection load
5. **P95 latency** for Redis operations < 10ms

---

## Estimated Effort

- Phase 1: 4-6 hours (blocking pool)
- Phase 2: 3-4 hours (operation optimization)
- Phase 3: 1-2 hours (config module)
- Phase 4: 1-2 hours (NP optimization)
- Phase 5: 2-3 hours (monitoring)

**Total: 11-17 hours**
