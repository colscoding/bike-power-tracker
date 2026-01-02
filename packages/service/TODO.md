# Service TODOs & Roadmap

## Technical Improvements

### Code Quality & Type Safety
- [x] **Strict TypeScript**: Ensure `noImplicitAny` and strict mode are fully enforced.
- [x] **DTO Validation**: Migrate custom validation logic to a library like `zod` for robust request validation.
- [x] **Error Handling**: Implement a centralized error handling middleware to ensure consistent error responses.
- [x] **Logging**: Replace `console.log` with a structured logger (e.g., `pino` or `winston`) for better production observability.

### Testing
- [x] **Migrate Tests to TypeScript**: Convert existing `.js` tests in `tests/` to `.ts` to benefit from type checking in tests.
- [x] **Coverage**: Increase unit test coverage for helper functions and middleware.
- [x] **Integration Tests**: Add more scenarios for edge cases in streaming (e.g., network interruptions).

### Infrastructure & Performance
- [x] **Redis Connection Pooling**: Review and stress-test the custom `RedisConnectionPool` implementation.
- [x] **Graceful Shutdown**: Ensure all Redis clients (including blocking ones) and database connections close cleanly on SIGTERM.
- [x] **Docker Optimization**: Verify multi-stage build efficiency and minimize image size.

### Documentation
- [x] **OpenAPI**: Automate `openapi.yaml` generation from code or ensure it stays in sync with `src/routes`.
- [x] **JSDoc**: Ensure all public functions and modules have comprehensive JSDoc comments.

## Feature Roadmap

### Core Functionality
- [x] **Workout Persistence**: Fully implement storing finished workouts in PostgreSQL/SQLite via Prisma.
- [ ] **User Management**: Add user registration and login (JWT-based) to replace simple API Key auth.
- [ ] **Multi-stream Support**: Enhance the ability to filter streams by metadata (e.g., location, bike type).

### Analytics & Data
- [x] **Workout Summaries**: Create endpoints to retrieve aggregated stats (avg power, max cadence, etc.) for past workouts.

### Real-time
- [ ] **Bi-directional Communication**: Investigate WebSockets if client needs to send commands back to the bike/service (currently SSE is one-way).
- [ ] **Stream Replay**: Add capability to replay a past stream for analysis or simulation.
