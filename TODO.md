# Bike Power Tracker - Development Roadmap & TODO

> Last updated: December 30, 2025
>
> This document contains a comprehensive analysis of the project and a prioritized roadmap for future development.

## Table of Contents

- [Project Health Summary](#project-health-summary)
- [Phase 1: Foundation & Stability](#phase-1-foundation--stability-priority-critical)
- [Phase 2: Core Feature Completion](#phase-2-core-feature-completion-priority-high)
- [Phase 3: User Experience](#phase-3-user-experience-priority-medium)
- [Phase 4: Advanced Features](#phase-4-advanced-features-priority-low)
- [Phase 5: Scale & Enterprise](#phase-5-scale--enterprise-priority-future)
- [Technical Debt](#technical-debt)
- [Quick Wins](#quick-wins-easy-high-impact)

---

## Project Health Summary

| Category | Status | Score |
|----------|--------|-------|
| **Architecture** | Modular monorepo, TypeScript, ES Modules | ⭐⭐⭐⭐⭐ |
| **Code Quality** | TypeScript strict mode, ESLint 9, well-documented | ⭐⭐⭐⭐⭐ |
| **Test Coverage** | 324 tests (209 client + 115 service), E2E with Playwright | ⭐⭐⭐⭐⭐ |
| **Documentation** | Comprehensive READMEs and guides | ⭐⭐⭐⭐⭐ |
| **Security** | Input validation, rate limiting, helmet, CORS | ⭐⭐⭐⭐ |
| **DevOps** | Docker ready, CI needs work | ⭐⭐⭐ |
| **Features** | MVP complete, missing competitive features | ⭐⭐⭐ |
| **Accessibility** | Screen reader, keyboard nav, reduced motion | ⭐⭐⭐⭐⭐ |

**Overall Grade: A** - Excellent foundation with TypeScript, comprehensive test coverage, and accessibility features

---

## Recently Completed

### Accessibility Improvements ✅ (December 30, 2025)

Comprehensive accessibility updates for screen readers, keyboard navigation, and motion preferences:

#### Screen Reader Support
- **ARIA Live Regions**: Added `aria-live="polite"` to all metric displays (power, cadence, heart rate)
- **Status Announcements**: Screen reader announcements for workout start/stop, sensor connections, dialog open/close
- **Semantic HTML**: Added `role` attributes, `aria-label`, `aria-labelledby` throughout
- **Dialog Accessibility**: All modals have `role="dialog"`, `aria-modal`, and proper labeling

#### Keyboard Navigation
- **New Module**: `ui/accessibility.ts` for keyboard shortcuts and screen reader utilities
- **Keyboard Shortcuts**:
  - `Space` - Start/stop workout recording
  - `Escape` - Close modal or menu
  - `M` - Toggle menu
  - `S` - Open settings
  - `H` - Open workout history
  - `E` - Export data
- **Skip Link**: Added "Skip to main content" link for keyboard users
- **Focus Management**: Visible focus indicators with `:focus-visible` styling

#### Visual Accessibility
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` support
- **Focus Styles**: High-contrast focus indicators with outline and box-shadow
- **Color Contrast**: Updated notification colors for WCAG AA compliance

#### Files Changed
- `index.html`: 50+ accessibility attributes added
- `main.css`: New accessibility utilities section
- `ui/accessibility.ts`: New 250+ line accessibility module
- `ui/time.ts`: Screen reader announcements on state changes
- `ui/notifications.ts`: Accessible toast notifications

### Test Coverage Improvements ✅ (December 30, 2025)

Increased test coverage for client package with 32 tests covering critical paths:

#### New Test Files
- **`streamManager.test.ts`** (16 tests): StreamManager initialization, pause/resume, stop streaming, status tracking, timestamp generation, state handling
- **`ui/notifications.test.ts`** (3 tests): Notification types, color mapping, timeout constants
- **`ui/time.test.ts`** (3 tests): Timer display logic, button text, workout lifecycle
- **`connect.test.ts`** (10 tests): Bluetooth connection mocking, event listeners, disconnect handling, power/HR/cadence value parsing, data format tests

#### Coverage Areas
- Core streaming logic (critical path)
- UI notification utilities
- Timer display components
- Bluetooth sensor connection modules (power, heart rate, cadence)
- Data format parsing (UINT8, UINT16, little-endian)

### TypeScript Migration ✅ (December 30, 2025)

Full TypeScript migration completed for both packages. See [TYPESCRIPT_MIGRATION_PLAN.md](./docs/TYPESCRIPT_MIGRATION_PLAN.md) for details.

#### Client Package (`packages/client`)
- **Type Definitions**: 8 files in `src/types/` (measurements, connections, time, stream, elements, export, bluetooth, pwa)
- **Source Files**: 25+ files migrated including:
  - Core: `MeasurementsState.ts`, `streamManager.ts`, `getInitState.ts`
  - Bluetooth: `connect-power.ts`, `connect-heartrate.ts`, `connect-cadence.ts`
  - API: `api/streamClient.ts`, `api/workoutClient.ts`
  - UI: 9 files in `ui/` (notifications, time, menu, settings, wakeLock, serviceWorker, installPrompt, streamViewer, workoutHistory)
  - Utilities: `getTimestring.ts`, `merge-measurements.ts`, `create-csv.ts`, `create-tcx.ts`
- **Entry Point**: `main.ts` (updated from `main.js`)
- **Config**: `tsconfig.json` with ES2022, strict mode, bundler resolution
- **Scripts**: `typecheck`, `test` (tsx), `build` (typecheck + vite)

#### Service Package (`packages/service`)
- **Type Definitions**: 5 files in `src/types/` (workout, user, stream, db, index)
- **Source Files**: Modular architecture with:
  - `server.ts`, `config.ts`, `redis.ts`, `utils.ts`, `validation.ts`
  - `middleware/` (auth, cors)
  - `routes/` (health, streams, workouts, users)
  - `db/` (index, workoutService, userService)
- **Module System**: ES Modules (`"type": "module"`)
- **Config**: `tsconfig.json` with ESNext, strict mode, bundler resolution
- **Testing**: Mocha with tsx loader, native assert
- **Scripts**: `typecheck`, `start`, `dev`, `build`, `test`

#### Verification
- ✅ Client: TypeScript compiles, Vite build passes, 176 tests pass
- ✅ Service: TypeScript compiles, ESLint 9 passes, 115 tests pass

### Technical Debt Cleanup ✅ (December 30, 2025)

Completed all technical debt items from the backlog:

#### High Priority (Done)
- ✅ Full TypeScript migration for both packages
- ✅ Server modularization (routes, middleware, config separated)
- ✅ Input validation middleware with 22 security tests

#### Medium Priority (Done)
- ✅ Replaced chai with native `node:assert/strict` (8 test files)
- ✅ Updated ESLint to v9 with flat config (`eslint.config.mjs`)
- ✅ Added Redis connection pooling (2-10 connections)

#### Low Priority (Done)
- ✅ Converted service to ES Modules (`"type": "module"`)
- ✅ Optimized `listenAll` polling with stream registry cache (30s TTL, parallel type checks)

---

## Phase 1: Foundation & Stability (Priority: Critical)

### 1.1 CI/CD Pipeline

- [ ] **Add GitHub Actions test workflow**
  - Run `pnpm test` on all packages
  - Run `pnpm test:e2e` with Playwright
  - Run on PR and push to main
  - Cache pnpm dependencies

- [ ] **Add Docker build verification**
  - Build Docker image on PR
  - Verify health check passes
  - Optional: Push to GitHub Container Registry

- [ ] **Add security scanning**
  - Dependabot for dependency updates
  - npm audit in CI pipeline
  - Container vulnerability scanning (Trivy)

### 1.2 Code Quality Enforcement

- [x] **Add TypeScript to client package** ✅ *Completed Dec 30, 2025*
  - Strict mode configuration (`tsconfig.json`)
  - Type definitions for all modules (8 type files)
  - All 25+ source files migrated to TypeScript
  - Build verification with `pnpm run typecheck`

- [x] **Add TypeScript to service package** ✅ *Completed Dec 30, 2025*
  - Strict mode configuration (`tsconfig.json`)
  - Type definitions for workout, user, stream, db (5 type files)
  - All 5 source files migrated to TypeScript
  - Full JSDoc documentation throughout

- [ ] **Add ESLint to CI**
  - ~~Update to ESLint 9~~ ✅ *Done - using flat config (eslint.config.mjs)*
  - Configure for both packages
  - Add pre-commit hooks (husky + lint-staged)

- [ ] **Add Prettier for formatting**
  - Configure for JS/TS, JSON, MD files
  - Add format check to CI

- [x] **Increase test coverage** ✅ *Completed Dec 30, 2025*
  - ✅ Added tests for `streamManager.ts` (`streamManager.test.ts` - 16 tests)
  - ✅ Added tests for UI components (`ui/notifications.test.ts`, `ui/time.test.ts` - 6 tests)
  - ✅ Added tests for Bluetooth modules (`connect.test.ts` - 10 tests)
  - Total: 32 tests in client package (up from original set)
  - Coverage: Core streaming, UI utilities, Bluetooth connection logic

### 1.3 Security Hardening

- [ ] **Fix rate limiting**
  - Current: 100,000 req/min (effectively disabled)
  - Recommended: 100 req/min for general, 1000 for SSE
  - Add per-endpoint rate limits

- [x] **Remove API key from query string**
  - Support header only (`X-API-Key`) for all endpoints
  - SSE client uses fetch-based implementation with headers (not EventSource)
  - Server still accepts query string for SSE with deprecation warning (backwards compat)
  - Added security logging for deprecated query string usage

- [x] **Add input validation middleware**
  - Validate stream names (alphanumeric, max 64 chars)
  - Validate message content (max 100KB)
  - Validate author names (max 64 chars)
  - Sanitize data before Redis storage
  - 22 security tests added

- [x] **Production CORS configuration**
  - Warning logged if `CORS_ORIGIN='*'` in production
  - Supports comma-separated allowed origins
  - Validates origins against allowed list in production

---

## Phase 2: Core Feature Completion (Priority: High)


### 2.2 Power & HR Zones

- [ ] **User profile settings**
  - FTP (Functional Threshold Power) input
  - Max heart rate input
  - Weight input
  - Save to local storage + optional sync

- [ ] **Zone calculation**
  - Power zones (7-zone Coggan model)
  - HR zones (5-zone model)
  - Real-time zone display
  - Color-coded indicators

- [ ] **Zone time tracking**
  - Time in each zone during workout
  - Post-workout zone distribution chart

### 2.3 Real-time Visualization

- [ ] **Live metrics graph**
  - Rolling 60-second power chart
  - Heart rate overlay
  - Use lightweight library (Chart.js or uPlot)
  - Responsive canvas sizing

- [x] **Workout summary screen** ✅ *Done*
  - Display after stopping workout
  - Average/max/min for all metrics
  - Option to save or discard
  - Accessible modal with focus trap

### 2.4 Export Improvements

- [x] **FIT file export** ✅ *Done*
  - Industry standard binary format
  - Smaller file size than TCX
  - Custom FIT encoder implementation
  - Includes power, heart rate, cadence

- [ ] **Direct Strava upload**
  - OAuth integration (from 2.1)
  - Upload TCX/FIT after workout
  - Auto-sync option in settings

---

## Phase 3: User Experience (Priority: Medium)

### 3.1 Bluetooth Reliability

- [x] **Auto-reconnect on disconnect** ✅ *Done*
  - Detects `gattserverdisconnected` event
  - Exponential backoff (1s, 2s, 4s, 8s, 16s)
  - Max 5 reconnection attempts
  - Shows "Reconnecting..." status on button
  - Notifications for success/failure

- [x] **Device name display** ✅ *Done*
  - Shows connected device name in button text
  - Notification on connection with device name
  - Battery level indicator (if supported)
  - Signal strength indicator


- [x] **Connection error UI** ✅ *Completed Dec 30, 2025*
  - User-friendly error messages for all Bluetooth error types
  - Troubleshooting suggestions with actionable tips
  - Retry button for recoverable errors

### 3.2 Accessibility

- [x] **Screen reader support** ✅ *Completed Dec 30, 2025*
  - ✅ Added `aria-live="polite"` to metric displays
  - ✅ Added `aria-label` to all buttons
  - ✅ Announce connection status changes via `ui/accessibility.ts`
  - ✅ Added skip navigation link

- [x] **Keyboard navigation** ✅ *Completed Dec 30, 2025*
  - ✅ Space to start/stop recording
  - ✅ Escape to close modals/menus
  - ✅ M to toggle menu, S for settings, H for history, E for export
  - ✅ Visible focus indicators (`:focus-visible` styling)

- [ ] **Color contrast**
  - Audit with WCAG 2.1 AA tools
  - Fix status badge colors
  - High contrast mode option

- [x] **Reduced motion** ✅ *Completed Dec 30, 2025*
  - ✅ Added `prefers-reduced-motion` media query
  - ✅ Disables animations for users who prefer

### 3.3 UI/UX Improvements

- [x] **Dark mode** ✅ *Completed Dec 30, 2025*
  - ✅ CSS custom properties for theming (30+ variables)
  - ✅ `prefers-color-scheme` media query for auto dark mode
  - ✅ Manual toggle in hamburger menu
  - ✅ Persist preference in localStorage (`bpt-dark-mode`)
  - ✅ Early init script prevents flash of light theme


- [x] **Undo for discard** ✅ *Completed Dec 30, 2025*
  - Custom confirmation modal with clear warning
  - 5-second undo toast with countdown and progress bar
  - Full data restoration including UI state

- [x] **Onboarding flow** ✅ *Completed Dec 31, 2025*
  - First-run setup wizard with multi-step flow
  - FTP/HR max/weight entry with validation
  - Sensor pairing guide
  - Feature tour and keyboard shortcuts overview

- [x] **Keyboard shortcuts** ✅ *Completed Dec 31, 2025*
  ```
  Space     - Start/stop recording
  L         - Mark lap
  Escape    - Close modal/panel
  S         - Open settings
  M         - Open menu
  H         - Open history
  E         - Export data
  ```

### 3.4 Mobile Optimization

- [ ] **Add tablet breakpoint**
  - 768px-1024px specific styles
  - Two-column layout for metrics

- [ ] **Touch target sizing**
  - Minimum 44x44px for all buttons
  - Increase spacing between controls

- [ ] **Landscape orientation**
  - Horizontal layout for metrics
  - Side-by-side stats

- [ ] **iOS safe areas**
  - Handle notch/home indicator
  - Adjust fixed positioning

---

## Phase 4: Advanced Features (Priority: Low)

### 4.1 Structured Workouts

- [x] **Workout builder** ✅ *Completed Jan 6, 2026*
  - [x] Define intervals (power target, duration)
  - [x] Warm-up and cool-down phases
  - [x] Rest intervals

- [x] **Workout player** ✅ *Basic version implemented Jan 6, 2026*
  - [x] Visual countdown/progress
  - [x] Audio cues for intervals ✅ *Added Jan 6, 2026*
  - [x] Auto-advance through phases

- [ ] **Workout library**
  - [x] Pre-built workouts (FTP test, sweet spot, VO2max) ✅ *Completed Jan 6, 2026*
  - [x] Save custom workouts ✅ *Completed Jan 6, 2026*
  - [x] Share workouts (export/import) ✅ *Completed Jan 6, 2026*

### 4.2 Extended Hardware Support

- [ ] **Fitness Machine Power Control (FTMS)**
  - Connect to FTMS smart indoor bikes
  - Read supported features
  - ERG mode (target power)
  - Simulation mode (virtual gradient)

- [ ] **Other Fitness Equipment (FTMS)**
  - [ ] Rowing Machines (0x2AD1) - Stroke rate, count, power
  - [ ] Cross Trainers (0x2ACE)
  - [ ] Step Climbers (0x2ACF)

- [ ] **Speed & Cadence Enhancements**
  - [ ] Running Speed & Cadence (RSC) 0x1814 (Foot Pods)
  - [ ] Cycling Speed 0x1816 (parse wheel revolutions from CSC)

- [ ] **Health Devices**
  - [ ] Bluetooth Weight Scales (Body Composition 0x181B)


### 4.3 Analytics & History

- [x] **Workout history UI improvements** ✅ *Completed Jan 2, 2025*
  - Calendar view of workouts
  - Weekly/monthly summaries
  - Filter by date range, type

- [x] **Performance charts**
  - [x] Power curve (best efforts) ✅ *Completed Jan 2, 2025*
  - [x] FTP progression over time ✅ *Completed Jan 6, 2026*
  - [x] Training load (TSS/week) ✅ *Completed Jan 2, 2025*
  - [x] Fitness/fatigue model (CTL/ATL) ✅ *Completed Jan 6, 2026*

- [x] **Personal records**
  - [x] Track PRs for various durations ✅ *Completed Jan 2, 2025*
  - [x] Notifications on new PRs ✅ *Completed Jan 6, 2026*
  - [x] PR history ✅ *Completed Jan 6, 2026*

---

## Phase 5: Scale & Enterprise (Priority: Future)

### 5.1 Horizontal Scaling

- [ ] **Kubernetes deployment**
  - Helm charts
  - Horizontal pod autoscaler
  - Redis Cluster support

- [ ] **SSE connection handling**
  - Sticky sessions or
  - WebSocket migration or
  - Redis pub/sub for multi-instance

- [ ] **Database scaling**
  - Read replicas for PostgreSQL
  - Connection pooling (PgBouncer)
  - Query optimization

### 5.2 Monitoring & Observability

- [ ] **Prometheus metrics**
  - Request latency histograms
  - Active connections gauge
  - Error rate counters
  - Custom business metrics

- [ ] **Grafana dashboards**
  - Infrastructure dashboard
  - Application dashboard
  - Business metrics dashboard

- [ ] **Centralized logging**
  - Structured JSON logging
  - Loki or ELK stack
  - Correlation IDs

- [ ] **Alerting**
  - PagerDuty/Slack integration
  - Error rate thresholds
  - Latency thresholds

### 5.3 Enterprise Features

- [ ] **Multi-tenancy**
  - Organization accounts
  - Team management
  - Role-based access

- [ ] **Audit logging**
  - Track user actions
  - Compliance reporting
  - Data retention policies

- [ ] **API rate limiting tiers**
  - Free tier limits
  - Paid tier allowances
  - Usage dashboard

---

## Technical Debt

### High Priority

| Issue | Location | Effort | Impact | Status |
|-------|----------|--------|--------|--------|
| ~~Add TypeScript to client~~ | `client/src/` | High | High | ✅ Done |
| ~~Add TypeScript to service~~ | `service/src/` | High | High | ✅ Done |
| ~~Split `server.ts` into modules~~ | `service/src/` | Medium | High | ✅ Done |
| ~~Align Node engine versions~~ | `package.json` files | Low | Low | ✅ Done |
| ~~Remove old .js source files~~ | Both packages | Low | Medium | ✅ Done |

### Medium Priority

| Issue | Location | Effort | Impact |
|-------|----------|--------|--------|
| ~~Replace chai with native assert~~ | `service/tests/` | Low | Low | ✅ Done |
| ~~Update ESLint to v9~~ | Root | Medium | Low | ✅ Done |
| ~~Migrate tests to TypeScript~~ | Both packages | Medium | Medium | ✅ Done (client) |
| ~~Add connection pooling for Redis~~ | `service/src/server.ts` | Medium | Medium | ✅ Done |

### Low Priority

| Issue | Location | Effort | Impact |
|-------|----------|--------|--------|
| ~~Convert service to ES Modules~~ | `service/src/` | Medium | Low | ✅ Done |
| ~~Optimize `listenAll` polling~~ | `service/src/routes/streams.ts` | Medium | Medium | ✅ Done |

---

## Quick Wins (Easy, High Impact)

These items can be completed quickly with significant user benefit:

### Can Do Today (< 1 hour each)

1. [x] **Add keyboard shortcut for start/stop (Space key)** ✅ *Done*
2. [x] **Show device name after Bluetooth connection** ✅ *Done*
3. [ ] **Add lap button to UI**
4. [ ] **Fix rate limiting to sensible value (100/min)**
5. [x] **Add `aria-live` to metric displays** ✅ *Done*
6. [x] **Add dark mode CSS (using `prefers-color-scheme`)** ✅ *Done*

### Can Do This Week (< 1 day each)

1. [x] **Add GitHub Actions test workflow** ✅ *Partially done - needs CI/CD setup*
2. [x] **Implement Bluetooth auto-reconnect** ✅ *Done*
3. [x] **Add post-workout summary modal** ✅ *Done*
4. [x] **Show/hide metrics based on connection** ✅ *Done Jan 6, 2026*
5. [ ] **Add power/HR zone indicators**
6. [x] **Custom discard confirmation modal (replace `confirm()`)** ✅ *Done*

### Can Do This Month (< 1 week each)

1. [ ] **Implement live metrics chart**
2. [x] **Add FIT file export** ✅ *Done*
3. [ ] **Implement OAuth login (Strava)**
4. [ ] **Add structured workout builder**
5. [x] **Full accessibility audit and fixes** ✅ *Done - screen reader, keyboard, reduced motion*

---

## Version Roadmap

| Version | Theme | Key Features | Target |
|---------|-------|--------------|--------|
| **1.1** | Stability | CI/CD, Rate limiting fixes, Bug fixes | Q1 2026 |
| **1.2** | Zones | Power/HR zones, User profiles | Q1 2026 |
| **1.3** | Visualization | Live charts, Lap markers | Q2 2026 |
| **2.0** | Authentication | OAuth, User accounts, Sync | Q2 2026 |
| **2.1** | Exports | Strava direct upload, TCX enhancements | Q3 2026 |
| **2.2** | Workouts | Structured workouts, Workout library | Q3 2026 |
| **3.0** | Smart Trainer | FTMS support, ERG mode | Q4 2026 |
| **3.1** | Analytics | Charts, PRs, Training load | Q4 2026 |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to these improvements.

When picking up a task:
1. Create a GitHub issue if one doesn't exist
2. Reference the task ID from this document
3. Follow the branch naming convention: `feature/task-name`
4. Update this document when complete

---

## Notes

- Priority levels: Critical > High > Medium > Low > Future
- Effort estimates: Low (< 1 day), Medium (1-3 days), High (> 3 days)
- All estimates are for a single experienced developer
- Some features may require design decisions/discussions first
