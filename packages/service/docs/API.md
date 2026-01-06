# API Documentation

The Service exposes a RESTful API and Server-Sent Events (SSE) for real-time data.

## Base URL

-   **Development**: `http://localhost:3000`
-   **Production**: Defined by your deployment env (e.g., `https://api.biketracker.com`)

## Authentication

Authentication is handled via middleware checking for `Authorization` headers or API Keys. See `src/middleware/` for details.

## Endpoints

### Health Check

-   `GET /health`: Check service status, database connectivity, and Redis status.

### Streams (Redis)

The service acts as a relay for sensor data using Redis Streams.

-   `POST /streams`: Create a new stream.
-   `GET /streams/:streamName`: Get stream info.
-   `POST /streams/:streamName/messages`: Publish a message to a stream.
-   `GET /streams/:streamName/messages`: Retrieve historical messages (supports pagination).

### Real-time (SSE)

-   `GET /realtime/subscribe/:streamName`: Open a persistent connection to receive new messages for a specific stream.

### Workouts

-   `POST /workouts`: Start/Save a workout.
-   `GET /workouts`: List past workouts.
-   `GET /workouts/:id`: Get details for a specific workout.

### Users

-   `POST /users/register`: Create a new user account.
-   `POST /users/login`: Authenticate a user.
-   `GET /users/me`: Get current user profile.

## OpenAPI Spec

The full OpenAPI specification is available in `openapi.yaml` at the root of the service package. You can view this using any Swagger compatible viewer.
