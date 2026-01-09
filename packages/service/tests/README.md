# Integration Tests

This directory contains comprehensive integration tests for the Bike Power Tracker service. These tests verify end-to-end functionality with real Redis and PostgreSQL instances.

## Test Structure

### Test Files

- **`integration-setup.ts`**: Shared utilities for test environment setup and teardown
- **`full-workflow.integration.test.ts`**: Complete workout lifecycle and workflow tests
- **`database.integration.test.ts`**: Database operations, queries, and data integrity tests
- **`sse-streaming.integration.test.ts`**: Server-Sent Events (SSE) streaming functionality tests

### Test Categories

#### Full Workflow Tests
Tests complete end-to-end user workflows:
- Stream creation and message handling
- Workout lifecycle (create → pause → resume → complete)
- User FTP management and history
- Stream management operations
- Health checks and error handling

#### Database Integration Tests
Tests database operations with PostgreSQL:
- Workout CRUD operations
- Telemetry storage and retrieval
- User management and FTP tracking
- Query filtering and pagination
- Data integrity and constraints
- Workout statistics calculation

#### SSE Streaming Tests
Tests real-time streaming functionality:
- SSE connection lifecycle
- Message broadcasting to multiple listeners
- Connection handling and cleanup
- Performance under rapid message delivery
- Error handling and disconnection scenarios

## Running Tests

### Prerequisites

1. **Redis**: Must be running on `localhost:6379` (or set `REDIS_HOST` and `REDIS_PORT`)
2. **PostgreSQL** (optional): For database tests, set `DATABASE_URL` and `DATABASE_PROVIDER`

Start services with Docker Compose:

```bash
docker-compose up -d redis postgres
```

### Run All Integration Tests

```bash
pnpm test:integration:all
```

### Run Specific Test Suites

```bash
# Full workflow tests
pnpm test:integration:full

# Database tests (requires PostgreSQL)
pnpm test:integration:database

# SSE streaming tests
pnpm test:integration:sse
```

### Run Existing Integration Tests

```bash
# Legacy integration tests
pnpm test:integration
```

## Environment Configuration

### Required Environment Variables

- `REDIS_HOST`: Redis host (default: `localhost`)
- `REDIS_PORT`: Redis port (default: `6379`)

### Optional Environment Variables

For database tests:
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_PROVIDER`: Set to `postgresql`

Example `.env` for integration tests:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://biketracker:password@localhost:5432/biketracker?schema=public
```

## Test Architecture

### Setup and Teardown

Each test suite uses `setupTestEnvironment()` and `teardownTestEnvironment()` from `integration-setup.ts`:

1. **Setup**: Creates Redis client, Prisma client (if DB available), and Express app
2. **Teardown**: Cleans up test data from Redis and PostgreSQL, closes connections

### Test Data Isolation

- All test streams use prefixes like `test-stream-`, `test-workout-`
- Test users have `test-user-` prefix in authId
- Cleanup removes all test data after each suite
- Unique timestamps prevent test interference

### Database Test Skipping

Tests that require PostgreSQL check for `env.prisma` and automatically skip if database is unavailable:

```typescript
if (!env.prisma) {
    this.skip();
}
```

This allows running a subset of tests with only Redis.

## Test Utilities

### Helper Functions

- **`setupTestEnvironment()`**: Initialize test environment
- **`teardownTestEnvironment(env)`**: Clean up resources
- **`createTestUser(prisma, authId?)`**: Create test user in database
- **`waitForCondition(condition, timeout)`**: Wait for async conditions
- **`generateTestWorkoutData(overrides)`**: Generate workout data objects

### Example Usage

```typescript
import {
    setupTestEnvironment,
    teardownTestEnvironment,
    createTestUser,
    type TestEnvironment,
} from './integration-setup.js';

describe('My Integration Test', function () {
    let env: TestEnvironment;

    before(async function () {
        env = await setupTestEnvironment();
    });

    after(async function () {
        await teardownTestEnvironment(env);
    });

    it('should test something', async function () {
        if (!env.prisma) {
            this.skip();
        }

        const user = await createTestUser(env.prisma);
        // ... test code
    });
});
```

## Best Practices

### Test Timeouts

- Full workflow tests: 15 seconds
- Database tests: 15 seconds
- SSE tests: 20 seconds (due to connection overhead)

Adjust with `this.timeout(ms)` in describe or it blocks.

### Assertions

Use `node:assert/strict` for clear error messages:

```typescript
import assert from 'node:assert/strict';

assert.strictEqual(actual, expected);
assert.ok(value);
assert.rejects(asyncFn, errorMatcher);
```

### Cleanup

Always clean up resources in `after` hooks:

```typescript
after(async function () {
    await teardownTestEnvironment(env);
});
```

### Skipping Tests

Skip tests gracefully when dependencies unavailable:

```typescript
before(async function () {
    if (!env.prisma) {
        this.skip();
    }
});
```

## Continuous Integration

For CI environments:

1. Start services before tests:
   ```bash
   docker-compose up -d redis postgres
   docker-compose exec postgres pg_isready -U biketracker
   ```

2. Run migrations:
   ```bash
   pnpm db:migrate:deploy
   ```

3. Run tests:
   ```bash
   pnpm test:integration:all
   ```

4. Clean up:
   ```bash
   docker-compose down -v
   ```

## Troubleshooting

### Connection Errors

**Redis connection refused**:
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` environment variables

**PostgreSQL connection failed**:
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` format
- Run migrations: `pnpm db:migrate:deploy`

### Test Failures

**Tests hang or timeout**:
- Increase timeout with `this.timeout(ms)`
- Check for unclosed connections in test code
- Verify cleanup in `after` hooks

**Data conflicts**:
- Ensure unique stream names with timestamps
- Verify cleanup is running properly
- Check for leftover data: `redis-cli KEYS test-*`

### Debugging

Enable verbose logging:

```bash
DEBUG=* pnpm test:integration:all
```

Run single test:

```bash
pnpm exec mocha tests/full-workflow.integration.test.ts --grep "should create a stream"
```

## Coverage

Integration tests cover:
- ✅ Stream creation and management
- ✅ Message publishing and retrieval
- ✅ SSE real-time broadcasting
- ✅ Workout CRUD operations
- ✅ Telemetry storage and queries
- ✅ User and FTP management
- ✅ Pagination and filtering
- ✅ Error handling
- ✅ Multi-client scenarios
- ✅ Data integrity constraints

## Future Enhancements

Potential additions:
- Performance benchmarks
- Load testing with multiple concurrent workouts
- Redis Streams consumer group tests
- WebSocket alternative tests
- Authentication and authorization tests
- Rate limiting verification
- Metrics and monitoring tests
