# Authentication

This document describes the authentication mechanisms used in the Bike Power Tracker service.

## Current Implementation: API Key

The service currently uses a simple Shared Secret (API Key) for securing write operations and protected endpoints.

### Configuration

The API Key is defined via the `API_KEY` environment variable.

*   **Environment Variable**: `API_KEY`
*   **Default**: If not set, authentication is disabled (open access).

### Usage

Clients must include the API key in the `X-API-Key` HTTP header for protected requests.

```http
POST /api/workouts
Host: localhost:3000
X-API-Key: your-secret-key
Content-Type: application/json

{
  ...
}
```

### Server-Sent Events (SSE)

For SSE endpoints (e.g., `/api/stream/listen`), the API key can be passed via a query parameter, as `EventSource` does not support custom headers in standard browsers.

```
GET /api/stream/listen?apiKey=your-secret-key
```

*Note: The server logs a warning when the API key is passed via query string to encourage header usage where possible.*

## Future Roadmap: User Authentication

The database schema (`packages/service/prisma/schema.prisma`) has been designed to support full user authentication in the future, including:

*   **User Accounts**: `User` model with email and password hash.
*   **OAuth**: Support for providers like Strava and Google.
*   **Personal API Keys**: `ApiKey` model to allow users to generate their own keys.

These features are defined in the schema but are not yet enforced by the application middleware.
