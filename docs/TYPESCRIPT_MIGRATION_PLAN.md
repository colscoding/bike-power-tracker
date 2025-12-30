# TypeScript Migration Plan

> Created: December 30, 2025
> **Status: COMPLETED ✅**
> 
> This document outlines the strategy for migrating the Bike Power Tracker project to TypeScript.

## Migration Status

| Phase | Status | Date Completed |
|-------|--------|----------------|
| Phase 1: Client Package | ✅ Complete | December 30, 2025 |
| Phase 2: Service Package | ✅ Complete | December 30, 2025 |
| Phase 3: Shared Types | 🔄 Optional (deferred) | - |

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Migration Strategy](#migration-strategy)
- [Phase 1: Client Package](#phase-1-client-package)
- [Phase 2: Service Package](#phase-2-service-package)
- [Phase 3: Shared Types](#phase-3-shared-types)
- [Testing Strategy](#testing-strategy)
- [Rollback Plan](#rollback-plan)

---

## Overview

The project has been fully migrated to TypeScript:

| Package | Framework | Module System | Lines of Code (est.) |
|---------|-----------|---------------|---------------------|
| `client` | Vite + TypeScript | ES Modules | ~2,000 |
| `service` | Express + TypeScript | ES Modules | ~1,800 |

### Current State

- **Client**: TypeScript with strict mode, Vite build system, PWA features, 70+ tests ✅
- **Service**: TypeScript with strict mode, ES Modules, Express server, Prisma ORM, Redis with connection pooling, 115+ tests ✅
- **Tests**: Node.js built-in test runner (client), Mocha with tsx (service)

---

## Goals

1. **Type Safety**: Catch bugs at compile-time instead of runtime ✅
2. **Better IDE Support**: Improved autocomplete, refactoring, and navigation ✅
3. **Self-Documenting Code**: Types serve as documentation ✅
4. **Easier Refactoring**: Confidence when making changes ✅
5. **API Contracts**: Clear interfaces between modules ✅
6. **Gradual Migration**: Maintain working code throughout migration ✅

---

## Migration Strategy

### Approach: Incremental Migration

We'll use a **gradual migration** approach rather than a big-bang rewrite:

1. Add TypeScript configuration alongside existing JavaScript
2. Enable `allowJs` to let JS and TS coexist
3. Migrate files one at a time, starting with:
   - Shared types and interfaces
   - Core business logic
   - Utility functions
   - UI components
   - Tests

### File Naming Convention

- TypeScript source: `*.ts`
- TypeScript React/JSX: `*.tsx` (if needed later)
- Type definitions: `*.d.ts` (for ambient declarations)

---

## Phase 1: Client Package

### Step 1.1: Setup TypeScript Configuration

```bash
# Install TypeScript and types
pnpm --filter client add -D typescript @types/node
```

Create `packages/client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "useDefineForClassFields": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.2: Create Type Definitions

Create shared types in `packages/client/src/types/`:

#### `packages/client/src/types/measurements.ts`
```typescript
export interface Measurement {
  timestamp: number;
  value: number;
}

export interface MeasurementsData {
  heartrate: Measurement[];
  power: Measurement[];
  cadence: Measurement[];
}

export type MeasurementType = 'heartrate' | 'power' | 'cadence';
```

#### `packages/client/src/types/connections.ts`
```typescript
export interface ConnectionsState {
  power: boolean;
  cadence: boolean;
  heartrate: boolean;
}
```

#### `packages/client/src/types/time.ts`
```typescript
export interface TimeState {
  isRecording: boolean;
  startTime: number | null;
  elapsedTime: number;
  pausedTime: number;
}
```

#### `packages/client/src/types/bluetooth.ts`
```typescript
export interface BluetoothDevice {
  id: string;
  name: string | undefined;
  gatt?: BluetoothRemoteGATTServer;
}

export interface BluetoothCharacteristic {
  uuid: string;
  value: DataView | null;
  addEventListener(type: string, listener: (event: Event) => void): void;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}
```

### Step 1.3: Migration Order (Client)

1. **Core Types** (new files)
   - `src/types/measurements.ts`
   - `src/types/connections.ts`
   - `src/types/time.ts`
   - `src/types/bluetooth.ts`
   - `src/types/stream.ts`
   - `src/types/index.ts` (barrel export)

2. **Utility Functions** (simplest, pure functions)
   - `src/getTimestring.ts`
   - `src/merge-measurements.ts`
   - `src/create-csv.ts`
   - `src/create-tcx.ts`

3. **State Management**
   - `src/MeasurementsState.ts`
   - `src/getInitState.ts`

4. **API Layer**
   - `src/api/streamClient.ts`
   - `src/api/workoutClient.ts`

5. **Bluetooth Connections**
   - `src/connect-power.ts`
   - `src/connect-cadence.ts`
   - `src/connect-heartrate.ts`

6. **UI Components**
   - `src/ui/time.ts`
   - `src/ui/menu.ts`
   - `src/ui/settings.ts`
   - ... (all ui/ files)

7. **Initialization**
   - `src/streamManager.ts`
   - `src/initConnectionButtons.ts`
   - `src/initMetricsDisplay.ts`
   - `src/initStreamingControls.ts`
   - `src/main.ts`

---

## Phase 2: Service Package

### Step 2.1: Setup TypeScript Configuration

```bash
# Install TypeScript and types
pnpm --filter service add -D typescript @types/node @types/express ts-node
```

Create `packages/service/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 2.2: Create Type Definitions

#### `packages/service/src/types/workout.ts`
```typescript
export interface WorkoutSummary {
  avgPower?: number;
  maxPower?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgHeartrate?: number;
  maxHeartrate?: number;
  totalDistance?: number;
  totalCalories?: number;
}

export interface WorkoutData {
  id: string;
  userId?: string;
  streamName?: string;
  title?: string;
  description?: string;
  sport: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | 'DELETED';
  summary?: WorkoutSummary;
  telemetry?: string;
}
```

#### `packages/service/src/types/api.ts`
```typescript
import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  apiKey?: string;
}

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;
```

### Step 2.3: Migration Order (Service)

1. **Types** (new files)
   - `src/types/workout.ts`
   - `src/types/api.ts`
   - `src/types/redis.ts`
   - `src/types/index.ts`

2. **Utilities**
   - `src/utils.ts`

3. **Database Layer**
   - `src/db/index.ts`
   - `src/db/workoutService.ts`
   - `src/db/userService.ts`

4. **Main Server**
   - `src/server.ts`

---

## Phase 3: Shared Types

### Step 3.1: Create Shared Package

For types shared between client and service, create a new package:

```
packages/
  shared/
    package.json
    tsconfig.json
    src/
      index.ts
      measurements.ts
      workout.ts
```

### Step 3.2: Shared Type Definitions

```typescript
// packages/shared/src/measurements.ts
export interface Measurement {
  timestamp: number;
  value: number;
}

export interface StreamMessage {
  type: 'heartrate' | 'power' | 'cadence';
  timestamp: number;
  value: number;
}

export interface WorkoutMetadata {
  id: string;
  startTime: number;
  title?: string;
  sport: string;
}
```

---

## Testing Strategy

### Client Tests

- Keep using Node.js built-in test runner
- Add `tsx` for running TypeScript tests
- Update test scripts:
  ```json
  "test": "NODE_ENV=test tsx --test src/**/*.test.ts"
  ```

### Service Tests

- Keep using Mocha
- Add `ts-node` for running TypeScript tests
- Update test scripts:
  ```json
  "test": "mocha --require ts-node/register 'tests/**/*.test.ts'"
  ```

### E2E Tests

- Playwright tests can remain JavaScript (they test the built app)
- Optionally migrate to TypeScript later for consistency

---

## Build Configuration

### Vite (Client)

Vite has built-in TypeScript support. Update `vite.config.js` → `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // ... existing config
});
```

### Service Build

Add build step to `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn src/server.ts"
  }
}
```

---

## Migration Checklist

### Pre-Migration

- [x] Analyze project structure
- [x] Document migration plan
- [ ] Create feature branch
- [ ] Ensure all tests pass

### Phase 1: Client

- [ ] Install TypeScript dependencies
- [ ] Create tsconfig.json
- [ ] Create base type definitions
- [ ] Migrate utility functions
- [ ] Migrate state management
- [ ] Migrate API layer
- [ ] Migrate Bluetooth connections
- [ ] Migrate UI components
- [ ] Migrate main entry point
- [ ] Update vite.config to .ts
- [ ] Update test configuration
- [ ] Verify all tests pass
- [ ] Verify build works

### Phase 2: Service

- [ ] Install TypeScript dependencies
- [ ] Create tsconfig.json
- [ ] Create base type definitions
- [ ] Migrate utilities
- [ ] Migrate database layer
- [ ] Migrate server
- [ ] Update test configuration
- [ ] Update Docker configuration
- [ ] Verify all tests pass

### Phase 3: Shared

- [ ] Create shared package
- [ ] Move shared types
- [ ] Update imports in client
- [ ] Update imports in service

### Post-Migration

- [ ] Enable strict mode everywhere
- [ ] Remove `allowJs` from configs
- [ ] Add TypeScript to CI/CD
- [ ] Update documentation
- [ ] Remove any remaining `any` types

---

## Rollback Plan

If issues arise during migration:

1. **Per-file rollback**: Rename `.ts` back to `.js` and revert changes
2. **Phase rollback**: Revert entire phase using git
3. **Full rollback**: Return to pre-migration branch

Keep the migration branch separate from main until fully tested.

---

## Timeline Estimate

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Client Setup | 1-2 hours | High |
| Client Types | 2-3 hours | High |
| Client Migration | 4-6 hours | High |
| Service Setup | 1-2 hours | Medium |
| Service Types | 2-3 hours | Medium |
| Service Migration | 3-4 hours | Medium |
| Shared Package | 2-3 hours | Low |
| Testing & Polish | 2-4 hours | High |

**Total: ~20-30 hours**

---

## Notes

- Vite has excellent TypeScript support out of the box
- Prisma already generates TypeScript types
- The Web Bluetooth API has community type definitions
- Consider using `zod` for runtime validation alongside TypeScript
