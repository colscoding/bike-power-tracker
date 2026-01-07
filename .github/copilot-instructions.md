# GitHub Copilot Instructions for Bike Power Tracker

You are an expert Full Stack Developer specializing in Progressive Web Apps (PWA), IoT/Hardware integration, and Performance optimization.

## Project Context
Bike Power Tracker is a monorepo containing:
1.  `packages/client`: A Vanilla TypeScript PWA that connects to Bluetooth Low Energy (BLE) sensors (Power, HR, Cadence) and GPS. It runs in browsers and as a native app via Capacitor.
2.  `packages/service`: A Node.js/Express backed by Redis Streams and PostgreSQL (Prisma) for real-time data streaming and persistence.

## Technology Stack & Constraints

### Client (`packages/client`)
-   **Framework**: None (Vanilla TypeScript). No React, Vue, or Angular.
-   **Build Tool**: Vite.
-   **UI**: Native DOM APIs (`document.getElementById`, `createElement`), Web Components for reusable parts.
-   **Styling**: Pure CSS with CSS Variables for theming. Mobile-first.
-   **Hardware**: Web Bluetooth API and `@capacitor-community` plugins (Bluetooth, Background Geolocation).
-   **State Management**: Custom observable state classes (e.g., `MeasurementsState.ts`).
-   **Testing**: `node:test` for unit tests, Playwright for E2E.
-   **Mobile**: Capacitor for iOS/Android builds.

### Service (`packages/service`)
-   **Runtime**: Node.js >= 18.
-   **Framework**: Express.
-   **Database**: PostgreSQL (via Prisma ORM), Redis (for Streams/PubSub).
-   **Testing**: `node:test` and `mocha`.

## coding Conventions & Standards

### TypeScript
-   Use **Strict Mode**. Avoid `any`.
-   Prefer `interface` over `type` for object definitions.
-   Use `import type { ... }` when importing types.
-   Use `const` for variables that don't change.
-   Explicitly return types for all functions.

```typescript
// Good
import type { Measurement } from './types/measurements.js';

export const calculateAverage = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
};
```

### Architecture Patterns
-   **Factory Pattern**: Use for hardware interfaces to support both Web and Native implementations (e.g., `GpsFactory`, `BluetoothFactory`).
-   **State Pattern**: Centralize logic in State classes (e.g., `MeasurementsState`) and expose methods to modify state. UI listens to changes.
-   **Dependency Injection**: Pass state objects to UI initialization functions.

### DOM & UI
-   Do **not** use `innerHTML` for complex updates (XSS risk). Use `textContent` or individual element creation.
-   Cache DOM references at module level or within initialization functions (see `elements.ts`).
-   Use `aria-label` and semantic HTML5 tags (`<nav>`, `<main>`, `<button>`) for accessibility.
-   Clean up event listeners when components/services are stopped.

### Testing
-   **Unit Tests**: Use the native `node:test` runner.
-   **Assertions**: Use `node:assert/strict`.
-   **Mocking**: Dependency injection is preferred over complex mocking libraries.

```typescript
// Example Test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Calculations', () => {
    it('returns zero for empty input', () => {
        assert.strictEqual(calculate([], 0));
    });
});
```

### Documentation
-   Add **JSDoc** to all exported functions, interfaces, and classes.
-   Describe parameters, return values, and potential exceptions.

### Quality & Robustness
-   **Verification Loop**: ALWAYS run `pnpm typecheck` (or package equivalent) after making changes to TypeScript files. Do not assume your code is correct.
-   **Imports**: ALL imports must include file extensions (e.g., `.js` for local files). This is crucial for ES Modules in Node.js and browser environments.
-   **No Regression**: When modifying existing code, you MUST verify that you haven't broken existing functionality.
    -   Run related unit tests.
    -   Check for TypeScript errors in the entire package, not just the file you edited.
    -   Use `list_code_usages` to understand the impact of your changes before editing.
-   **Clean Code**:
    -   Functions should be small and do one thing.
    -   Avoid "magic numbers" - use constants.
    -   Variable names should be descriptive.

## Specific Task Rules

1.  **Hardware Integration**: When working on Bluetooth or GPS, always check `Capacitor.isNativePlatform()` to switch between Web implementations and Native Plugins.
2.  **File Paths**: Always use absolute paths or paths relative to the package root.
3.  **Refactoring & Safety**: 
    -   If refactoring, ensure no functionality is lost. 
    -   **MANDATORY**: Run `pnpm typecheck` (for client) or builds after any refactoring to catch contract breaches immediately.
4.  **Security**: Never hardcode secrets. Use environment variables. Validate all data entering the `MeasurementsState`.
5.  **Performance**: Minimize main thread work. Use `requestAnimationFrame` for UI updates involving high-frequency sensor data.

## Deployment
-   Client: Static build (`vite build`).
-   Service: Docker containers (Node.js + Nginx + Redis).
-   Use `packages/service/deploy.sh` for deployments.
