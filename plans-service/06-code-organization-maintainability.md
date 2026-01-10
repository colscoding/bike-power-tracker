# Code Organization and Maintainability Plan

## Overview

This plan addresses code organization, documentation, testing patterns, and developer experience improvements to enhance long-term maintainability.

## Current State Assessment

### Strengths
- Clear module separation in service package
- Well-documented code with JSDoc comments
- Consistent naming conventions
- Proper type definitions in separate files
- Comprehensive test coverage (324 tests)
- Monorepo structure with pnpm workspaces

### Areas for Improvement

1. **Inconsistent module structure** across packages
2. **Missing API documentation** for consumers
3. **No code generation** for repeated patterns
4. **Limited debugging tools** for development
5. **No contribution guidelines** for maintainers
6. **Testing patterns** could be more consistent

---

## Implementation Plan

### Phase 1: Standardize Module Structure

**Priority: HIGH**

#### 1.1 Define standard folder structure

```
packages/
├── service/
│   ├── src/
│   │   ├── config/           # Configuration modules
│   │   │   ├── index.ts      # Main config export
│   │   │   ├── redis.ts
│   │   │   ├── database.ts
│   │   │   └── security.ts
│   │   │
│   │   ├── db/               # Database layer
│   │   │   ├── index.ts      # Export all repositories
│   │   │   ├── client.ts     # Prisma client
│   │   │   ├── repositories/ # Data access
│   │   │   ├── migrations/   # Migration scripts
│   │   │   └── queries/      # Query builders
│   │   │
│   │   ├── errors/           # Error definitions
│   │   │   ├── index.ts
│   │   │   ├── base.ts       # AppError class
│   │   │   ├── http.ts       # HTTP errors
│   │   │   └── domain.ts     # Domain-specific errors
│   │   │
│   │   ├── middleware/       # Express middleware
│   │   │   ├── index.ts      # Export all
│   │   │   ├── auth.ts
│   │   │   ├── cors.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimit.ts
│   │   │
│   │   ├── monitoring/       # Observability
│   │   │   ├── index.ts
│   │   │   ├── metrics.ts
│   │   │   ├── logging.ts
│   │   │   └── health.ts
│   │   │
│   │   ├── redis/            # Redis layer
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── pool.ts
│   │   │   ├── streams.ts
│   │   │   └── scripts.ts
│   │   │
│   │   ├── routes/           # API routes
│   │   │   ├── index.ts      # Router composition
│   │   │   ├── streams.ts
│   │   │   ├── workouts.ts
│   │   │   └── health.ts
│   │   │
│   │   ├── schemas/          # Validation schemas
│   │   │   ├── index.ts
│   │   │   ├── workout.ts
│   │   │   ├── stream.ts
│   │   │   └── user.ts
│   │   │
│   │   ├── services/         # Business logic
│   │   │   ├── index.ts
│   │   │   ├── workoutService.ts
│   │   │   └── streamService.ts
│   │   │
│   │   ├── types/            # TypeScript types
│   │   │   ├── index.ts
│   │   │   ├── express.d.ts
│   │   │   ├── workout.ts
│   │   │   └── stream.ts
│   │   │
│   │   ├── utils/            # Utility functions
│   │   │   ├── index.ts
│   │   │   ├── async.ts
│   │   │   ├── validation.ts
│   │   │   └── typeGuards.ts
│   │   │
│   │   ├── app.ts            # Express app setup
│   │   └── server.ts         # Server entry point
│   │
│   ├── test/                 # Tests mirror src structure
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   │
│   └── scripts/              # Development scripts
│       ├── seed.ts
│       └── migrate.ts
```

#### 1.2 Create barrel exports

**File: `packages/service/src/index.ts`**

```typescript
// Main entry point for library consumers

// Types
export * from './types/index.js';

// Schemas
export * from './schemas/index.js';

// Errors
export * from './errors/index.js';

// Services (if exposing as library)
export { WorkoutService } from './services/workoutService.js';
export { StreamService } from './services/streamService.js';

// Utilities
export * from './utils/index.js';
```

**File: `packages/service/src/types/index.ts`**

```typescript
// Export all types from a single location
export type { WorkoutSummary, WorkoutSettings, TelemetryPoint } from './workout.js';
export type { StreamMessage, StreamMetadata } from './stream.js';
export type { TypedRequest, TypedResponse } from './express.js';
```

---

### Phase 2: Documentation Standards

**Priority: HIGH**

#### 2.1 JSDoc standards

**File: `packages/service/CONTRIBUTING.md`**

```markdown
# Documentation Standards

## JSDoc Comments

All public functions, classes, and types must have JSDoc comments.

### Function Documentation

\`\`\`typescript
/**
 * Calculate normalized power from telemetry data.
 *
 * Uses a 30-second rolling average of the 4th power of power values,
 * then takes the 4th root of the average.
 *
 * @param telemetry - Array of telemetry points with power values
 * @param windowSize - Size of the rolling window in seconds (default: 30)
 * @returns The normalized power value, or null if insufficient data
 *
 * @example
 * ```typescript
 * const np = calculateNormalizedPower(telemetry, 30);
 * if (np !== null) {
 *   console.log(`Normalized Power: ${np}W`);
 * }
 * ```
 *
 * @see https://www.trainingpeaks.com/learn/articles/normalized-power-intensity-factor-training-stress/
 */
export function calculateNormalizedPower(
  telemetry: TelemetryPoint[],
  windowSize = 30
): number | null {
  // implementation
}
\`\`\`

### Class Documentation

\`\`\`typescript
/**
 * Repository for managing workout data persistence.
 *
 * Provides CRUD operations for workouts with support for
 * filtering, pagination, and telemetry management.
 *
 * @example
 * ```typescript
 * const repo = new WorkoutRepository(prisma);
 * const workout = await repo.findById('123');
 * ```
 */
export class WorkoutRepository {
  /**
   * Create a new WorkoutRepository instance.
   * @param prisma - Prisma client instance
   */
  constructor(private prisma: PrismaClient) {}
}
\`\`\`

### Type Documentation

\`\`\`typescript
/**
 * Represents a single telemetry data point from a workout.
 *
 * @remarks
 * All sensor values are optional as not all devices provide all metrics.
 * Timestamp should be in milliseconds since epoch.
 */
export interface TelemetryPoint {
  /** Timestamp in milliseconds since epoch */
  timestamp: number;

  /** Power output in watts (0-3000) */
  power?: number;

  /** Cadence in RPM (0-300) */
  cadence?: number;

  /** Heart rate in BPM (30-250) */
  heartRate?: number;
}
\`\`\`
```

#### 2.2 API documentation with OpenAPI

**File: `packages/service/src/docs/openapi.ts`**

```typescript
import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Bike Power Tracker API',
    version: '1.0.0',
    description: 'Real-time streaming API for cycling workouts',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API base path',
    },
  ],
  paths: {
    '/streams': {
      get: {
        summary: 'List all streams',
        description: 'Returns a list of all active streams with metadata',
        operationId: 'listStreams',
        tags: ['Streams'],
        responses: {
          '200': {
            description: 'List of streams',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/StreamMetadata' },
                },
              },
            },
          },
        },
      },
    },
    '/streams/{name}/poll': {
      get: {
        summary: 'Poll stream for messages',
        description: 'Long-poll for new messages on a stream using SSE',
        operationId: 'pollStream',
        tags: ['Streams'],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Stream name',
          },
          {
            name: 'lastId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Last message ID received',
          },
        ],
        responses: {
          '200': {
            description: 'SSE stream of messages',
            content: {
              'text/event-stream': {},
            },
          },
        },
      },
    },
    // ... more paths
  },
  components: {
    schemas: {
      StreamMetadata: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          length: { type: 'integer' },
          firstEntry: { type: 'string', nullable: true },
          lastEntry: { type: 'string', nullable: true },
        },
        required: ['name', 'length'],
      },
      WorkoutSummary: {
        type: 'object',
        properties: {
          duration: { type: 'integer', description: 'Duration in seconds' },
          avgPower: { type: 'number', nullable: true },
          maxPower: { type: 'number', nullable: true },
          normalizedPower: { type: 'number', nullable: true },
        },
        required: ['duration'],
      },
      // ... more schemas
    },
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
};
```

#### 2.3 Add API docs endpoint

**File: `packages/service/src/routes/docs.ts`**

```typescript
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../docs/openapi.js';

const router = Router();

// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Bike Power Tracker API Docs',
}));

export { router as docsRouter };
```

---

### Phase 3: Testing Improvements

**Priority: MEDIUM**

#### 3.1 Test utilities and factories

**File: `packages/service/test/factories/workout.ts`**

```typescript
import { Workout, WorkoutStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';

export interface WorkoutFactoryOptions {
  userId?: string;
  status?: WorkoutStatus;
  name?: string;
  duration?: number;
  startTime?: Date;
}

export function createWorkout(options: WorkoutFactoryOptions = {}): Workout {
  const now = new Date();
  const startTime = options.startTime ?? faker.date.recent({ days: 7 });
  const duration = options.duration ?? faker.number.int({ min: 1800, max: 7200 });

  return {
    id: faker.string.uuid(),
    userId: options.userId ?? faker.string.uuid(),
    status: options.status ?? WorkoutStatus.COMPLETED,
    name: options.name ?? faker.lorem.words(3),
    startTime,
    endTime: new Date(startTime.getTime() + duration * 1000),
    duration,
    telemetryCount: faker.number.int({ min: 100, max: 10000 }),
    summaryJson: null,
    settingsJson: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTelemetryPoints(
  count: number,
  options: {
    startPower?: number;
    powerVariance?: number;
    cadenceRange?: [number, number];
  } = {}
): TelemetryPoint[] {
  const {
    startPower = 200,
    powerVariance = 50,
    cadenceRange = [80, 100],
  } = options;

  const points: TelemetryPoint[] = [];
  let timestamp = Date.now() - count * 1000;

  for (let i = 0; i < count; i++) {
    points.push({
      timestamp: timestamp + i * 1000,
      power: startPower + faker.number.int({ min: -powerVariance, max: powerVariance }),
      cadence: faker.number.int({ min: cadenceRange[0], max: cadenceRange[1] }),
      heartRate: faker.number.int({ min: 120, max: 170 }),
    });
  }

  return points;
}
```

#### 3.2 Test setup utilities

**File: `packages/service/test/setup.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { beforeAll, afterAll, beforeEach } from 'node:test';

let prisma: PrismaClient;
let redis: ReturnType<typeof createClient>;

export async function setupTestEnvironment() {
  prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.TEST_DATABASE_URL || 'file:./test.db' },
    },
  });

  redis = createClient({
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
  });

  await prisma.$connect();
  await redis.connect();

  return { prisma, redis };
}

export async function teardownTestEnvironment() {
  await prisma.$disconnect();
  await redis.quit();
}

export async function cleanDatabase() {
  // Delete in order of dependencies
  await prisma.telemetryPoint.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
}

export async function cleanRedis() {
  await redis.flushDb();
}

export function createTestHarness() {
  return {
    setup: setupTestEnvironment,
    teardown: teardownTestEnvironment,
    clean: async () => {
      await cleanDatabase();
      await cleanRedis();
    },
    prisma: () => prisma,
    redis: () => redis,
  };
}
```

#### 3.3 Snapshot testing for API responses

**File: `packages/service/test/integration/api-snapshots.test.ts`**

```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestHarness } from '../setup.js';
import { createWorkout } from '../factories/workout.js';

const harness = createTestHarness();

describe('API Response Snapshots', () => {
  let app: Express.Application;

  before(async () => {
    await harness.setup();
    app = createApp({ prisma: harness.prisma(), redis: harness.redis() });
  });

  after(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.clean();
  });

  describe('GET /api/workouts/:id', () => {
    it('should match response structure', async () => {
      const workout = createWorkout();
      await harness.prisma().workout.create({ data: workout });

      const response = await request(app)
        .get(`/api/workouts/${workout.id}`)
        .expect(200);

      // Validate structure without checking exact values
      assert.ok(response.body.id);
      assert.ok(response.body.status);
      assert.ok(response.body.startTime);
      assert.ok(response.body.createdAt);

      // Validate types
      assert.strictEqual(typeof response.body.id, 'string');
      assert.strictEqual(typeof response.body.duration, 'number');
    });
  });
});
```

---

### Phase 4: Developer Experience

**Priority: MEDIUM**

#### 4.1 Debug configuration

**File: `.vscode/launch.json`**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Service",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "service", "dev"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "service", "test"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Current Test File",
      "type": "node",
      "request": "launch",
      "program": "${file}",
      "cwd": "${workspaceFolder}/packages/service",
      "runtimeArgs": ["--test", "--test-reporter=spec"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

#### 4.2 Development scripts

**File: `packages/service/scripts/dev-utils.ts`**

```typescript
#!/usr/bin/env tsx

import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const program = new Command();

program
  .name('dev-utils')
  .description('Development utilities for bike-power-tracker');

program
  .command('seed')
  .description('Seed database with sample data')
  .option('-w, --workouts <number>', 'Number of workouts', '10')
  .action(async (options) => {
    const prisma = new PrismaClient();
    // Seeding logic
    console.log(`Seeding ${options.workouts} workouts...`);
    await prisma.$disconnect();
  });

program
  .command('clear-redis')
  .description('Clear all Redis data')
  .action(async () => {
    const redis = createClient();
    await redis.connect();
    await redis.flushAll();
    console.log('Redis cleared');
    await redis.quit();
  });

program
  .command('stream-stats')
  .description('Show Redis stream statistics')
  .action(async () => {
    const redis = createClient();
    await redis.connect();

    const streams: string[] = [];
    for await (const key of redis.scanIterator({ MATCH: 'stream:*' })) {
      streams.push(key);
    }

    console.log(`Found ${streams.length} streams:`);
    for (const stream of streams) {
      const info = await redis.xInfoStream(stream);
      console.log(`  ${stream}: ${info.length} messages`);
    }

    await redis.quit();
  });

program.parse();
```

#### 4.3 Git hooks with husky

**File: `.husky/pre-commit`**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged
pnpm lint-staged

# Type check
pnpm --filter service typecheck
```

**File: `package.json` (root)**

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

---

### Phase 5: Error Boundaries and Logging

**Priority: MEDIUM**

#### 5.1 Structured logging standards

**File: `packages/service/src/monitoring/logging.ts`**

```typescript
import pino from 'pino';

export interface LogContext {
  requestId?: string;
  userId?: string;
  workoutId?: string;
  streamName?: string;
  operation?: string;
  duration?: number;
}

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['*.password', '*.apiKey', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with context
 */
export function createLogger(context: LogContext) {
  return baseLogger.child(context);
}

/**
 * Log operation with timing
 */
export async function logOperation<T>(
  logger: pino.Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    logger.info({ operation, duration, success: true }, `${operation} completed`);
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    logger.error(
      { operation, duration, success: false, err: error },
      `${operation} failed`
    );
    throw error;
  }
}

/**
 * Logging middleware
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.get('X-Request-ID') || crypto.randomUUID();
    const logger = createLogger({ requestId });

    // Attach to request
    (req as any).log = logger;

    const start = performance.now();

    res.on('finish', () => {
      const duration = Math.round(performance.now() - start);
      logger.info({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      }, 'Request completed');
    });

    next();
  };
}
```

---

### Phase 6: Code Quality Automation

**Priority: LOW**

#### 6.1 ESLint configuration

**File: `packages/service/eslint.config.js`**

```javascript
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Code style
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'prefer-const': 'error',

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'class', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
```

#### 6.2 Prettier configuration

**File: `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/service/CONTRIBUTING.md` | Documentation standards |
| `packages/service/src/docs/openapi.ts` | OpenAPI specification |
| `packages/service/src/routes/docs.ts` | API docs endpoint |
| `packages/service/test/factories/*.ts` | Test factories |
| `packages/service/test/setup.ts` | Test utilities |
| `packages/service/scripts/dev-utils.ts` | Development scripts |
| `.vscode/launch.json` | Debug configuration |
| `.husky/pre-commit` | Git hooks |
| `packages/service/eslint.config.js` | ESLint rules |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/service/src/index.ts` | Add barrel exports |
| `packages/service/src/types/index.ts` | Export all types |
| `packages/service/package.json` | Add scripts, lint-staged |

---

## Testing Requirements

### Code Quality Tests
- ESLint passes with no errors
- All types compile correctly
- Test coverage meets threshold

### Documentation Tests
- OpenAPI spec validates
- All public APIs documented
- Examples in docs work

---

## Success Metrics

1. **100% documented** public APIs
2. **Consistent code style** via automated formatting
3. **< 5 minute** developer onboarding for new contributors
4. **All debug scenarios** have launch configs
5. **< 30 second** pre-commit hook execution

---

## Estimated Effort

- Phase 1: 3-4 hours (module structure)
- Phase 2: 4-6 hours (documentation)
- Phase 3: 3-4 hours (testing improvements)
- Phase 4: 2-3 hours (developer experience)
- Phase 5: 2-3 hours (logging standards)
- Phase 6: 1-2 hours (automation)

**Total: 15-22 hours**
