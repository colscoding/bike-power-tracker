# Integration Tests Quick Start

Quick guide to get integration tests running.

## 1. Start Dependencies

Start Redis and PostgreSQL with Docker:

```bash
cd packages/service
docker-compose up -d redis postgres
```

Wait for services to be ready:

```bash
# Check Redis
docker-compose exec redis redis-cli ping
# Should output: PONG

# Check PostgreSQL
docker-compose exec postgres pg_isready -U biketracker
# Should output: accepting connections
```

## 2. Setup Database

Run Prisma migrations:

```bash
pnpm db:migrate:deploy
```

Or generate Prisma client:

```bash
pnpm db:generate
```

## 3. Configure Environment

Create or update `.env` file:

```bash
cp .env.example .env
```

Ensure these variables are set:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://biketracker:your-password@localhost:5432/biketracker?schema=public
```

## 4. Run Tests

### All Integration Tests

```bash
pnpm test:integration:all
```

### Individual Test Suites

```bash
# Full workflow tests (15s timeout)
pnpm test:integration:full

# Database tests (15s timeout)
pnpm test:integration:database

# SSE streaming tests (20s timeout)
pnpm test:integration:sse
```

### Legacy Integration Tests

```bash
pnpm test:integration
```

## 5. Run All Tests

To run unit tests, API tests, and integration tests:

```bash
pnpm test
```

## Expected Output

Successful test run:

```
  Full Workflow Integration Tests
    Complete Workout Workflow
      ✓ should create a stream for the workout
      ✓ should create a workout record if database is available
      ✓ should send multiple workout data points to the stream
      ...
    
  Database Integration Tests
    Workout Database Operations
      ✓ should create a workout with all fields
      ✓ should retrieve workout by ID
      ...

  SSE Streaming Integration Tests
    SSE Connection Lifecycle
      ✓ should establish SSE connection and receive initial event
      ✓ should receive messages through SSE
      ...

  60 passing (12s)
```

## Common Issues

### Redis Not Running

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**: Start Redis with `docker-compose up -d redis`

### PostgreSQL Not Running

```
Error: Can't reach database server
```

**Solution**: 
1. Start PostgreSQL: `docker-compose up -d postgres`
2. Run migrations: `pnpm db:migrate:deploy`

### Database Tests Skipped

If you see many tests being skipped, check:
1. `DATABASE_URL` is set in `.env`
2. PostgreSQL is running and accepting connections
3. Migrations are applied

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::6379
```

**Solution**: Stop existing services or change port in `.env`

## Cleanup

Stop and remove containers:

```bash
docker-compose down
```

Remove volumes (deletes all data):

```bash
docker-compose down -v
```

## Development Workflow

1. Start services: `docker-compose up -d`
2. Make code changes
3. Run relevant tests: `pnpm test:integration:all`
4. Fix any issues
5. Run full test suite: `pnpm test`
6. Commit changes

## CI/CD Integration

For automated testing pipelines:

```bash
#!/bin/bash
set -e

# Start services
docker-compose up -d redis postgres

# Wait for services
timeout 30 bash -c 'until docker-compose exec postgres pg_isready -U biketracker; do sleep 1; done'

# Setup database
pnpm db:migrate:deploy

# Run tests
pnpm test:integration:all

# Cleanup
docker-compose down -v
```

## Need Help?

See [tests/README.md](./README.md) for detailed documentation.
