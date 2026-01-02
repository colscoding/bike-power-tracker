# Development Guide

This document describes the development setup, project structure, and workflows for the Bike Power Tracker.

## Project Structure

The project is a monorepo managed with `pnpm` workspaces.

```
bike-power-tracker/
├── packages/
│   ├── client/       # Frontend PWA (Vite + TypeScript)
│   ├── service/      # Backend API (Express + TypeScript + Redis + Prisma)
│   └── simulation/   # Bluetooth sensor simulation tools
├── test-integration/ # End-to-end tests (Playwright)
└── docs/             # Documentation
```

## Technology Stack

### Client (`packages/client`)
*   **Framework**: Vanilla TypeScript with Web Components (Lit-like structure but custom).
*   **Build Tool**: Vite.
*   **Testing**: Node.js built-in test runner.
*   **Features**: PWA, Bluetooth Web API, WebSocket/SSE for real-time data.

### Service (`packages/service`)
*   **Runtime**: Node.js.
*   **Framework**: Express.
*   **Language**: TypeScript (ES Modules).
*   **Database**: 
    *   **Redis**: For real-time streams and pub/sub.
    *   **PostgreSQL**: For persistent storage (Users, Workouts).
    *   **ORM**: Prisma.
*   **Testing**: Mocha, Supertest.

## Getting Started

### Prerequisites
*   Node.js >= 18
*   pnpm >= 8
*   Docker (for Redis and PostgreSQL)

### Installation
```bash
pnpm install
```

### Running Development Environment

1.  **Start Infrastructure (Redis & Postgres)**:
    ```bash
    cd packages/service
    docker-compose up -d
    ```

2.  **Start Application**:
    From the root directory:
    ```bash
    pnpm dev
    ```
    This will start both the client (port 5173) and service (port 3000) in parallel.

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start client and service in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests for all packages |
| `pnpm test:integration` | Run Playwright E2E tests |
| `pnpm --filter client dev` | Start only the client |
| `pnpm --filter service dev` | Start only the service |

## Database Management

The service uses Prisma for database management.

```bash
cd packages/service

# Run migrations
pnpm db:migrate

# Open Prisma Studio (GUI)
pnpm db:studio
```

## TypeScript Configuration

The project has been fully migrated to TypeScript.
*   **Client**: Uses `vite-env.d.ts` and strict mode.
*   **Service**: Uses `tsx` for execution and `tsc` for type checking.
