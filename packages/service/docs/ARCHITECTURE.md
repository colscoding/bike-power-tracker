# Service Architecture

The **Bike Power Tracker Service** is a Node.js backend that provides data persistence, user management, and real-time streaming capabilities for the client application.

## High-Level Overview

The service follows a layered architecture:

-   **API Layer**: Express.js REST API with validation and OpenAPI documentation.
-   **Service Layer**: Business logic for users, workouts, and streams.
-   **Data Access Layer**: 
    -   **Prisma ORM**: For interacting with the relational database (PostgreSQL/SQLite).
    -   **Redis Client**: For high-performance streaming and Pub/Sub.

## Core Technologies

-   **Runtime**: Node.js (>=18)
-   **Framework**: Express.js
-   **Database**: PostgreSQL (Production) / SQLite (Development/Self-hosted)
-   **ORM**: Prisma
-   **Caching & Streaming**: Redis (Streams, Pub/Sub)
-   **Documentation**: OpenAPI (Swagger)
-   **Testing**: Node.js native test runner (`node:test`)

## Directory Structure

| Path | Description |
|------|-------------|
| `src/routes/` | API route definitions (Controllers) |
| `src/middleware/` | Express middleware (Auth, Validation, Error Handling) |
| `src/db/` | Database connection logic |
| `src/schemas.ts` | Zod validation schemas |
| `src/redis.ts` | Redis connection and helper wrapper |
| `prisma/` | Database schema and migrations |
| `openapi.yaml` | API Specification |

## Data Flow

1.  **Incoming Request**: Client sends a request (HTTP or opens EventSource).
2.  **Validation**: Middleware validates headers, auth tokens (if enabled), and request body using Zod schemas.
3.  **Processing**:
    -   **Persistence**: Data is stored/retrieved via Prisma.
    -   **Real-time**: Events are published to Redis Streams.
4.  **Response**: JSON response or Server-Sent Event (SSE) stream.
