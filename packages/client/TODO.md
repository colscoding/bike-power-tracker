# Client Development Plan

This document outlines the roadmap for the `packages/client` application. It focuses on feature completion, user experience enhancements, and technical improvements.

## 1. Core Features (Immediate Priority)

### Power & HR Zones
Building on the recently implemented User Profile and Zone Calculation logic:
- [x] **Real-time Zone Display**
  - Show current zone (1-7 for Power, 1-5 for HR) next to the metric.
  - Color-code the metric value based on the zone (e.g., Blue -> Green -> Yellow -> Orange -> Red).
  - Add a visual gauge or progress bar indicating position within the current zone.
- [x] **Zone Analysis**
  - Track accumulated time in each zone during the workout.
  - Display a post-workout distribution chart (histogram) in the Summary modal.
  - Include zone distribution in the exported data (if supported by format) or as a separate summary.

### Real-time Visualization
- [x] **Live Metrics Graph**
  - Implement a rolling 60-second chart for Power and Heart Rate.
  - Use a lightweight library (e.g., uPlot, Chart.js) or custom SVG implementation for performance.
  - Ensure smooth rendering (60fps) on mobile devices using `requestAnimationFrame`.
  - Add toggle to show/hide graph to save battery.

### Data Export & Integration
- [ ] **Strava Integration**
  - Implement OAuth2 flow for Strava authentication.
  - Add "Upload to Strava" button in the workout summary and history.
  - Handle token storage and refresh securely.
- [ ] **Dropbox/Google Drive Sync**
  - Auto-upload FIT/TCX files to a cloud folder.

## 2. User Experience Improvements

### Audio & Feedback
- [x] **Voice Feedback (Text-to-Speech)**
  - Announce lap splits (Time, Avg Power).
  - Announce zone changes ("Entering Threshold Zone").
  - Announce interval completion.
  - Add settings to toggle specific announcements.

### UI Polish
- [x] **Landscape Mode Optimization**
  - Optimize layout for phone landscape orientation (dashboard view).
- [x] **High Contrast Mode**
  - Ensure all charts and color-coded zones have high-contrast alternatives or patterns for colorblind users.
- [x] **Customizable Dashboard**
  - Allow users to choose which metrics to display (e.g., 3s Power vs Instant Power).

## 3. Technical Improvements

### Testing & Quality
- [x] **E2E Tests for Onboarding**
  - Add Playwright tests to verify the onboarding flow end-to-end.
- [x] **Visual Regression Testing**
  - Add snapshots for critical UI states (Workout, Summary, Onboarding).
- [x] **Fuzz Testing**
  - Test input parsing (Bluetooth data) with random/malformed data.

### Architecture & Performance
- [x] **Component Refactoring**
  - Refactor `ui/*.ts` modules into more isolated components.
  - Consider Web Components for reusable UI elements (gauges, graphs).
- [ ] **State Management**
  - Evaluate if `MeasurementsState` needs a more robust event system (e.g., RxJS or a lightweight signal library) as complexity grows.
- [x] **Offline Resilience**
  - Implement `IndexedDB` for robust workout recording persistence (prevent data loss on crash/reload).
  - Improve Service Worker caching strategy for offline-first capability.
