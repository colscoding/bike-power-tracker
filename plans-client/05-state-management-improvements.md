# State Management Improvements Plan

## Overview

This plan addresses state management issues including hardcoded values, tight coupling between state modules, and improving the reactivity and testability of state.

## Current State Assessment

### Strengths
- Plain object-based state (MeasurementsState, ConnectionsState, TimeState)
- Immutable-friendly (returns copies via toJSON())
- Built-in persistence to IndexedDB with throttled saves
- Observer pattern with onChange callbacks
- Crash recovery from IndexedDB

### Issues Identified

1. **Hardcoded values** (user weight = 75kg, gap thresholds)
2. **Tight coupling** between GPS and distance metrics
3. **Global state access** via `window.measurementsState`
4. **No standard interface** for calculation functions
5. **Energy calculation** has hardcoded constants
6. **Missing settings integration** for user preferences

---

## Implementation Plan

### Phase 1: Extract Configuration to Settings

**Priority: HIGH**

#### 1.1 Create settings store

**File: `packages/client/src/state/SettingsStore.ts`**

```typescript
import { openDB, IDBPDatabase } from 'idb';

export interface UserSettings {
  // User profile
  weight: number;          // kg
  height: number;          // cm
  age: number;
  gender: 'male' | 'female' | 'other';
  ftp: number;             // Functional Threshold Power
  maxHeartrate: number;
  restingHeartrate: number;

  // Display preferences
  units: 'metric' | 'imperial';
  dateFormat: 'ISO' | 'US' | 'EU';
  clockFormat: '12h' | '24h';

  // Calculation settings
  energyMethod: 'power' | 'heartrate' | 'combined';
  gapThreshold: number;    // seconds before resetting energy calc
  stalenessThreshold: number; // seconds before data considered stale

  // Power zones (percentage of FTP)
  powerZones: ZoneDefinition[];

  // Heart rate zones (percentage of max HR)
  heartrateZones: ZoneDefinition[];
}

export interface ZoneDefinition {
  name: string;
  min: number;
  max: number;
  color: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  weight: 75,
  height: 175,
  age: 30,
  gender: 'other',
  ftp: 200,
  maxHeartrate: 190,
  restingHeartrate: 60,

  units: 'metric',
  dateFormat: 'ISO',
  clockFormat: '24h',

  energyMethod: 'combined',
  gapThreshold: 20,
  stalenessThreshold: 5,

  powerZones: [
    { name: 'Recovery', min: 0, max: 55, color: '#808080' },
    { name: 'Endurance', min: 55, max: 75, color: '#2196f3' },
    { name: 'Tempo', min: 75, max: 90, color: '#4caf50' },
    { name: 'Threshold', min: 90, max: 105, color: '#ffeb3b' },
    { name: 'VO2max', min: 105, max: 120, color: '#ff9800' },
    { name: 'Anaerobic', min: 120, max: 150, color: '#f44336' },
    { name: 'Neuromuscular', min: 150, max: 1000, color: '#9c27b0' },
  ],

  heartrateZones: [
    { name: 'Recovery', min: 0, max: 60, color: '#808080' },
    { name: 'Endurance', min: 60, max: 70, color: '#2196f3' },
    { name: 'Tempo', min: 70, max: 80, color: '#4caf50' },
    { name: 'Threshold', min: 80, max: 90, color: '#ff9800' },
    { name: 'VO2max', min: 90, max: 100, color: '#f44336' },
  ],
};

type SettingsListener = (settings: UserSettings) => void;

class SettingsStore {
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners: SettingsListener[] = [];
  private db: IDBPDatabase | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await openDB('bpt-settings', 1, {
      upgrade(db) {
        db.createObjectStore('settings');
      },
    });

    const stored = await this.db.get('settings', 'user');
    if (stored) {
      this.settings = { ...DEFAULT_SETTINGS, ...stored };
    }

    this.initialized = true;
  }

  get<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key];
  }

  getAll(): UserSettings {
    return { ...this.settings };
  }

  async set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void> {
    this.settings[key] = value;
    await this.persist();
    this.notifyListeners();
  }

  async setMultiple(updates: Partial<UserSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.persist();
    this.notifyListeners();
  }

  async reset(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.persist();
    this.notifyListeners();
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  private async persist(): Promise<void> {
    if (this.db) {
      await this.db.put('settings', this.settings, 'user');
    }
  }

  private notifyListeners(): void {
    const settings = this.getAll();
    for (const listener of this.listeners) {
      try {
        listener(settings);
      } catch (e) {
        console.error('Settings listener error:', e);
      }
    }
  }
}

export const settingsStore = new SettingsStore();
```

#### 1.2 Update MeasurementsState to use settings

**File: `packages/client/src/state/measurements.ts`** (changes)

```typescript
import { settingsStore, UserSettings } from './SettingsStore.js';

export class MeasurementsState {
  // Remove hardcoded values
  // private _userWeight: number = 75; // DELETE THIS

  constructor() {
    // Subscribe to settings changes
    settingsStore.onChange((settings) => {
      this.onSettingsChange(settings);
    });
  }

  private get userWeight(): number {
    return settingsStore.get('weight');
  }

  private get gapThreshold(): number {
    return settingsStore.get('gapThreshold') * 1000; // Convert to ms
  }

  private get stalenessThreshold(): number {
    return settingsStore.get('stalenessThreshold') * 1000;
  }

  private onSettingsChange(settings: UserSettings): void {
    // Recalculate zones if FTP changed
    this._recalculateZones();
  }

  private _updateEnergy(timestamp: number, value: number, source: 'power' | 'heartrate'): void {
    const method = settingsStore.get('energyMethod');

    // Only use configured method
    if (method === 'power' && source !== 'power') return;
    if (method === 'heartrate' && source !== 'heartrate') return;

    // Use configured thresholds
    const gapThreshold = this.gapThreshold;

    // ... rest of calculation using this.userWeight
  }
}
```

---

### Phase 2: Decouple State Modules

**Priority: HIGH**

#### 2.1 Create event bus for state communication

**File: `packages/client/src/state/EventBus.ts`**

```typescript
type EventHandler<T = unknown> = (data: T) => void;

interface EventMap {
  'power:update': { timestamp: number; value: number; cadence?: number };
  'heartrate:update': { timestamp: number; value: number };
  'cadence:update': { timestamp: number; value: number };
  'speed:update': { timestamp: number; value: number };
  'gps:update': { timestamp: number; latitude: number; longitude: number; altitude?: number };
  'distance:update': { timestamp: number; value: number };
  'sensor:connected': { type: string; name: string };
  'sensor:disconnected': { type: string; name: string };
  'workout:start': { timestamp: number };
  'workout:pause': { timestamp: number };
  'workout:resume': { timestamp: number };
  'workout:stop': { timestamp: number };
  'lap:complete': { number: number; duration: number };
  'settings:change': { key: string; value: unknown };
}

class StateEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    }
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const stateEventBus = new StateEventBus();
```

#### 2.2 Separate GPS distance calculation

**File: `packages/client/src/state/calculators/DistanceCalculator.ts`**

```typescript
import { stateEventBus } from '../EventBus.js';

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export class DistanceCalculator {
  private lastPoint: GPSPoint | null = null;
  private totalDistance = 0;
  private lapDistance = 0;

  constructor() {
    // Listen to GPS updates instead of being called directly
    stateEventBus.on('gps:update', (data) => {
      this.handleGPSUpdate(data);
    });

    stateEventBus.on('lap:complete', () => {
      this.lapDistance = 0;
    });

    stateEventBus.on('workout:start', () => {
      this.reset();
    });
  }

  private handleGPSUpdate(data: { timestamp: number; latitude: number; longitude: number }): void {
    const point: GPSPoint = {
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.timestamp,
    };

    if (this.lastPoint) {
      const distance = this.calculateDistance(this.lastPoint, point);

      // Filter out unrealistic jumps (> 50m in 1 second would be > 180km/h)
      const timeDelta = (point.timestamp - this.lastPoint.timestamp) / 1000;
      const maxDistance = 50 * timeDelta; // 50m/s max

      if (distance <= maxDistance) {
        this.totalDistance += distance;
        this.lapDistance += distance;

        stateEventBus.emit('distance:update', {
          timestamp: point.timestamp,
          value: this.totalDistance,
        });
      }
    }

    this.lastPoint = point;
  }

  private calculateDistance(p1: GPSPoint, p2: GPSPoint): number {
    const R = 6371000; // Earth radius in meters
    const lat1 = (p1.latitude * Math.PI) / 180;
    const lat2 = (p2.latitude * Math.PI) / 180;
    const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  reset(): void {
    this.lastPoint = null;
    this.totalDistance = 0;
    this.lapDistance = 0;
  }

  getTotalDistance(): number {
    return this.totalDistance;
  }

  getLapDistance(): number {
    return this.lapDistance;
  }
}

export const distanceCalculator = new DistanceCalculator();
```

---

### Phase 3: Create Calculation Manager

**Priority: MEDIUM**

#### 3.1 Standard calculation interface

**File: `packages/client/src/state/calculators/types.ts`**

```typescript
export interface Calculator<TInput, TOutput> {
  /** Unique identifier for this calculator */
  id: string;

  /** Human-readable name */
  name: string;

  /** What events trigger recalculation */
  triggers: string[];

  /** Calculate derived value */
  calculate(input: TInput): TOutput;

  /** Reset calculator state */
  reset(): void;
}

export interface RollingCalculator<TInput, TOutput> extends Calculator<TInput, TOutput> {
  /** Window size in samples or time */
  windowSize: number;

  /** Add a sample to the rolling window */
  addSample(sample: TInput): void;

  /** Get current rolling value */
  getValue(): TOutput;
}

export interface AccumulatorCalculator<TInput, TOutput> extends Calculator<TInput, TOutput> {
  /** Add a sample to the accumulator */
  accumulate(sample: TInput): void;

  /** Get accumulated value */
  getTotal(): TOutput;
}
```

#### 3.2 Normalized Power Calculator

**File: `packages/client/src/state/calculators/NormalizedPowerCalculator.ts`**

```typescript
import type { RollingCalculator } from './types.js';
import { stateEventBus } from '../EventBus.js';

interface PowerSample {
  timestamp: number;
  power: number;
}

export class NormalizedPowerCalculator implements RollingCalculator<PowerSample, number | null> {
  id = 'normalizedPower';
  name = 'Normalized Power';
  triggers = ['power:update'];
  windowSize = 30; // 30-second rolling average

  private samples: PowerSample[] = [];
  private rollingAverages: number[] = [];
  private windowSum = 0;

  constructor() {
    stateEventBus.on('power:update', (data) => {
      this.addSample({ timestamp: data.timestamp, power: data.value });
    });

    stateEventBus.on('workout:start', () => {
      this.reset();
    });
  }

  addSample(sample: PowerSample): void {
    this.samples.push(sample);

    // Maintain 30-second window (assuming 1 sample/second)
    while (this.samples.length > this.windowSize) {
      const removed = this.samples.shift()!;
      this.windowSum -= removed.power;
    }

    this.windowSum += sample.power;

    // Only calculate if we have full window
    if (this.samples.length >= this.windowSize) {
      const avg = this.windowSum / this.windowSize;
      this.rollingAverages.push(avg);
    }
  }

  calculate(_input: PowerSample): number | null {
    return this.getValue();
  }

  getValue(): number | null {
    if (this.rollingAverages.length === 0) return null;

    // NP = 4th root of average of 4th powers of rolling averages
    let sumOfFourthPowers = 0;
    for (const avg of this.rollingAverages) {
      sumOfFourthPowers += Math.pow(avg, 4);
    }

    const avgFourthPower = sumOfFourthPowers / this.rollingAverages.length;
    return Math.pow(avgFourthPower, 0.25);
  }

  reset(): void {
    this.samples = [];
    this.rollingAverages = [];
    this.windowSum = 0;
  }
}

export const normalizedPowerCalculator = new NormalizedPowerCalculator();
```

#### 3.3 TSS Calculator

**File: `packages/client/src/state/calculators/TSSCalculator.ts`**

```typescript
import type { AccumulatorCalculator } from './types.js';
import { stateEventBus } from '../EventBus.js';
import { settingsStore } from '../SettingsStore.js';
import { normalizedPowerCalculator } from './NormalizedPowerCalculator.js';

export class TSSCalculator implements AccumulatorCalculator<number, number> {
  id = 'tss';
  name = 'Training Stress Score';
  triggers = ['power:update', 'workout:stop'];

  private durationSeconds = 0;
  private startTime: number | null = null;

  constructor() {
    stateEventBus.on('workout:start', (data) => {
      this.startTime = data.timestamp;
    });

    stateEventBus.on('workout:stop', () => {
      // TSS calculation happens at end of workout
    });
  }

  accumulate(durationSeconds: number): void {
    this.durationSeconds = durationSeconds;
  }

  calculate(_input: number): number {
    return this.getTotal();
  }

  getTotal(): number {
    const np = normalizedPowerCalculator.getValue();
    const ftp = settingsStore.get('ftp');

    if (!np || !ftp || this.durationSeconds === 0) return 0;

    const intensityFactor = np / ftp;
    const tss = (this.durationSeconds * np * intensityFactor) / (ftp * 3600) * 100;

    return Math.round(tss);
  }

  getIntensityFactor(): number | null {
    const np = normalizedPowerCalculator.getValue();
    const ftp = settingsStore.get('ftp');

    if (!np || !ftp) return null;
    return np / ftp;
  }

  reset(): void {
    this.durationSeconds = 0;
    this.startTime = null;
  }
}

export const tssCalculator = new TSSCalculator();
```

---

### Phase 4: Remove Global State Access

**Priority: MEDIUM**

#### 4.1 Create state provider for testing

**File: `packages/client/src/state/StateProvider.ts`**

```typescript
import { MeasurementsState } from './measurements.js';
import { ConnectionsState } from './connections.js';
import { TimeState } from './time.js';
import { settingsStore, SettingsStore } from './SettingsStore.js';

export interface AppState {
  measurements: MeasurementsState;
  connections: ConnectionsState;
  time: TimeState;
  settings: typeof settingsStore;
}

let appState: AppState | null = null;

export function initializeState(): AppState {
  if (appState) {
    console.warn('State already initialized');
    return appState;
  }

  appState = {
    measurements: new MeasurementsState(),
    connections: new ConnectionsState(),
    time: new TimeState(),
    settings: settingsStore,
  };

  // Initialize settings
  settingsStore.initialize();

  return appState;
}

export function getState(): AppState {
  if (!appState) {
    throw new Error('State not initialized. Call initializeState() first.');
  }
  return appState;
}

// For testing only
export function resetState(): void {
  appState = null;
}

// Development/testing helpers (only available in dev mode)
if (import.meta.env.DEV) {
  (window as any).__getAppState = getState;
  (window as any).__resetState = resetState;
}
```

#### 4.2 Update main.ts to use provider

**File: `packages/client/src/main.ts`** (changes)

```typescript
import { initializeState, getState } from './state/StateProvider.js';

// Initialize state first
const state = initializeState();

// Remove global assignments
// window.measurementsState = state.measurements; // DELETE
// window.connectionsState = state.connections;   // DELETE

// Components that need state should import getState()
```

---

### Phase 5: Improve State Reactivity

**Priority: LOW**

#### 5.1 Create reactive state wrapper

**File: `packages/client/src/state/ReactiveState.ts`**

```typescript
type PropertyListener<T> = (newValue: T, oldValue: T) => void;

export function createReactiveState<T extends object>(
  initialState: T
): T & { $watch: <K extends keyof T>(key: K, listener: PropertyListener<T[K]>) => () => void } {
  const listeners = new Map<keyof T, Set<PropertyListener<unknown>>>();
  const state = { ...initialState };

  const proxy = new Proxy(state, {
    set(target, prop, value) {
      const key = prop as keyof T;
      const oldValue = target[key];

      if (oldValue === value) return true;

      target[key] = value;

      const propListeners = listeners.get(key);
      if (propListeners) {
        for (const listener of propListeners) {
          try {
            listener(value, oldValue);
          } catch (e) {
            console.error('State listener error:', e);
          }
        }
      }

      return true;
    },
  });

  (proxy as any).$watch = <K extends keyof T>(
    key: K,
    listener: PropertyListener<T[K]>
  ): (() => void) => {
    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    listeners.get(key)!.add(listener as PropertyListener<unknown>);

    return () => {
      listeners.get(key)?.delete(listener as PropertyListener<unknown>);
    };
  };

  return proxy as T & { $watch: typeof proxy.$watch };
}

// Usage example:
// const state = createReactiveState({ power: 0, heartrate: 0 });
// state.$watch('power', (newVal, oldVal) => console.log(`Power: ${oldVal} -> ${newVal}`));
// state.power = 250; // Logs: "Power: 0 -> 250"
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/src/state/SettingsStore.ts` | User settings management |
| `packages/client/src/state/EventBus.ts` | State event communication |
| `packages/client/src/state/calculators/types.ts` | Calculator interfaces |
| `packages/client/src/state/calculators/DistanceCalculator.ts` | GPS distance |
| `packages/client/src/state/calculators/NormalizedPowerCalculator.ts` | NP calculation |
| `packages/client/src/state/calculators/TSSCalculator.ts` | TSS calculation |
| `packages/client/src/state/StateProvider.ts` | State initialization |
| `packages/client/src/state/ReactiveState.ts` | Reactive state utilities |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/client/src/state/measurements.ts` | Use settings, event bus |
| `packages/client/src/main.ts` | Use state provider |

---

## Success Metrics

1. **Zero hardcoded values** in state modules
2. **All calculations** use standard interface
3. **No global state** assignments
4. **Settings persisted** to IndexedDB
5. **Event-driven** communication between modules

---

## Estimated Effort

- Phase 1: 4-5 hours (settings store)
- Phase 2: 3-4 hours (event bus, decoupling)
- Phase 3: 4-5 hours (calculation manager)
- Phase 4: 2-3 hours (remove globals)
- Phase 5: 2-3 hours (reactive state)

**Total: 15-20 hours**
