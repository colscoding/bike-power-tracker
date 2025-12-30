# Contributing to Bike Power Tracker

Thank you for your interest in contributing to Bike Power Tracker! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributions from everyone regardless of experience level.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Redis (for testing streaming features)
- Git

### Setting Up Development Environment

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/bike-power-tracker.git
cd bike-power-tracker

# Add upstream remote
git remote add upstream https://github.com/colscoding/bike-power-tracker.git

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### Project Structure

```
bike-power-tracker/
├── packages/
│   ├── client/          # PWA (Vite + vanilla JS)
│   ├── service/         # API (Express + Redis)
│   └── simulation/      # Testing tools
├── test-integration/    # Cross-package tests
└── docs/                # Documentation
```

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-strava-export` - New features
- `fix/bluetooth-reconnect` - Bug fixes
- `docs/api-examples` - Documentation
- `refactor/state-management` - Code improvements
- `test/cadence-sensor` - Test additions

### Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   pnpm test           # Unit tests
   pnpm test:e2e       # E2E tests
   pnpm test:integration  # Integration tests
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "feat(client): add Strava export support"
   ```

### Commit Message Format

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding tests
- `chore` - Maintenance tasks

**Scopes:**
- `client` - Client package changes
- `service` - Service package changes
- `simulation` - Simulation package changes
- `docs` - Documentation changes

**Examples:**
```
feat(client): add TCX export with lap data
fix(service): handle Redis reconnection properly
docs(client): add Bluetooth troubleshooting guide
test(service): add workout API integration tests
```

## Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all tests**:
   ```bash
   pnpm test
   pnpm test:e2e
   ```

3. **Check for lint errors**:
   ```bash
   pnpm lint  # if available
   ```

4. **Update documentation** if needed

### PR Requirements

- Clear title and description
- Link to any related issues
- All tests passing
- Documentation updated (if applicable)
- No merge conflicts

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manually tested

## Related Issues
Closes #123
```

## Coding Standards

### JavaScript

- Use ES Modules (`import`/`export`)
- Use async/await for asynchronous code
- Add JSDoc comments for functions
- Use descriptive variable names
- Keep functions small and focused

**Example:**
```javascript
/**
 * Calculate average power from measurements
 * @param {Array<{power: number}>} measurements - Array of power readings
 * @returns {number} Average power in watts
 */
export function calculateAveragePower(measurements) {
    if (measurements.length === 0) return 0;
    
    const total = measurements.reduce((sum, m) => sum + (m.power || 0), 0);
    return Math.round(total / measurements.length);
}
```

### CSS

- Use CSS custom properties for theming
- Mobile-first responsive design
- Prefer `rem` units for spacing

### HTML

- Semantic elements (`<main>`, `<section>`, `<button>`)
- Accessible markup (ARIA labels where needed)
- Valid HTML5

## Testing Guidelines

### Unit Tests

Located in `*.test.js` files alongside source:

```javascript
import { describe, it, assert } from 'node:test';
import { calculateAveragePower } from './calculations.js';

describe('calculateAveragePower', () => {
    it('should return 0 for empty array', () => {
        assert.strictEqual(calculateAveragePower([]), 0);
    });
    
    it('should calculate average correctly', () => {
        const measurements = [{ power: 100 }, { power: 200 }];
        assert.strictEqual(calculateAveragePower(measurements), 150);
    });
});
```

### E2E Tests (Playwright)

Located in `test-e2e/`:

```javascript
import { test, expect } from '@playwright/test';

test('should display power reading', async ({ page }) => {
    await page.goto('/');
    
    // Mock Bluetooth sensor
    await page.evaluate(() => {
        window.measurementsState.addMeasurement({ power: 200 });
    });
    
    await expect(page.locator('#power-value')).toHaveText('200');
});
```

### What to Test

- **Unit**: Pure functions, state logic, calculations
- **E2E**: User flows, UI interactions, export functionality
- **Integration**: Client-service communication, database operations

## Documentation

### When to Update Docs

- Adding new features
- Changing API endpoints
- Modifying configuration options
- Adding new dependencies

### Where to Document

| Type | Location |
|------|----------|
| API changes | `packages/service/README.md`, `openapi.yaml` |
| Client features | `packages/client/README.md` |
| Configuration | Package README files |
| Deployment | `docs/` folder |

### JSDoc Comments

Add JSDoc to all exported functions:

```javascript
/**
 * Connect to a Bluetooth cycling power meter
 * 
 * @param {Object} options - Connection options
 * @param {Function} options.onData - Callback for power readings
 * @param {Function} options.onDisconnect - Callback when disconnected
 * @returns {Promise<BluetoothDevice>} Connected device
 * @throws {Error} If Bluetooth is not available
 * 
 * @example
 * const device = await connectPowerMeter({
 *     onData: (power) => console.log(`Power: ${power}W`),
 *     onDisconnect: () => console.log('Disconnected')
 * });
 */
export async function connectPowerMeter(options) {
    // ...
}
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security**: Email directly (see SECURITY.md)

## Recognition

Contributors will be recognized in:
- GitHub Contributors list
- Release notes for significant contributions

Thank you for contributing! 🚴
