# Client Type Safety Improvements Plan

## Overview

This plan addresses the 74+ instances of `any` type usage identified in the client codebase and proposes a systematic approach to achieve full type safety across all modules.

## Current State Assessment

### Strengths
- Strict TypeScript mode enabled in tsconfig
- `noUnusedLocals` and `noUnusedParameters` enforced
- Centralized type definitions in `/src/types/`
- Good JSDoc documentation throughout

### Issues Identified

1. **74 instances of `any` type** scattered across services and state management
2. **Loose type definitions** in some service modules
3. **GPS factory returns `any`** without proper typing
4. **DataFieldsManager uses `any`** for workout/user settings
5. **StreamManager uses `any`** for interval IDs
6. **MeasurementsState** has type-unsafe persistence operations

---

## Implementation Plan

### Phase 1: Audit and Categorize `any` Usage

**Priority: HIGH**

#### 1.1 Create type safety audit script

**File: `packages/client/scripts/type-audit.ts`**

```typescript
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface AnyUsage {
  file: string;
  line: number;
  context: string;
  category: 'explicit' | 'implicit' | 'assertion';
}

/**
 * Find all `any` type usages in the codebase
 */
function findAnyUsages(): AnyUsage[] {
  const result = execSync(
    `grep -rn ": any" src/ --include="*.ts" --include="*.tsx" || true`,
    { encoding: 'utf-8' }
  );

  const usages: AnyUsage[] = [];

  for (const line of result.split('\n').filter(Boolean)) {
    const match = line.match(/^(.+):(\d+):(.+)$/);
    if (match) {
      usages.push({
        file: match[1],
        line: parseInt(match[2], 10),
        context: match[3].trim(),
        category: categorize(match[3]),
      });
    }
  }

  return usages;
}

function categorize(context: string): AnyUsage['category'] {
  if (context.includes('as any')) return 'assertion';
  if (context.includes(': any')) return 'explicit';
  return 'implicit';
}

const usages = findAnyUsages();
console.log(`Found ${usages.length} 'any' usages:`);
console.log(`  Explicit: ${usages.filter(u => u.category === 'explicit').length}`);
console.log(`  Assertions: ${usages.filter(u => u.category === 'assertion').length}`);

// Group by file
const byFile = new Map<string, AnyUsage[]>();
for (const usage of usages) {
  const existing = byFile.get(usage.file) || [];
  existing.push(usage);
  byFile.set(usage.file, existing);
}

console.log('\nBy file:');
for (const [file, fileUsages] of byFile) {
  console.log(`  ${file}: ${fileUsages.length}`);
}
```

#### 1.2 Categorize by priority

| Category | Description | Priority |
|----------|-------------|----------|
| State Management | MeasurementsState, ConnectionsState | HIGH |
| API Clients | workoutClient, streamClient | HIGH |
| Services | Bluetooth, GPS | MEDIUM |
| Components | Web Components | MEDIUM |
| Utilities | Helper functions | LOW |

---

### Phase 2: State Management Type Safety

**Priority: HIGH**

#### 2.1 Type MeasurementsState properly

**File: `packages/client/src/state/measurements.ts`**

```typescript
// Current issue: any in persistence and callbacks
private _onChange: ((state: any) => void)[] = [];

// Fix: Define proper state type
export interface MeasurementsStateData {
  startTime: number | null;
  isActive: boolean;
  isPaused: boolean;

  // Power metrics
  power: MeasurementSeries;
  powerHistory: PowerHistoryEntry[];

  // Heart rate metrics
  heartrate: MeasurementSeries;

  // Cadence metrics
  cadence: MeasurementSeries;

  // Speed metrics
  speed: MeasurementSeries;

  // Distance metrics
  distance: DistanceData;

  // GPS data
  gps: GPSData;

  // Altitude
  altitude: AltitudeData;

  // Laps
  laps: Lap[];

  // Energy
  energy: EnergyData;
}

export interface MeasurementSeries {
  current: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  history: TimestampedValue[];
}

export interface TimestampedValue {
  timestamp: number;
  value: number;
}

export interface PowerHistoryEntry extends TimestampedValue {
  leftRightBalance?: number;
  pedalSmoothness?: number;
  torqueEffectiveness?: number;
}

export interface DistanceData {
  total: number;
  lap: number;
  lastUpdate: number | null;
}

export interface GPSData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  history: GPSPoint[];
}

export interface GPSPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

export interface AltitudeData {
  current: number | null;
  min: number | null;
  max: number | null;
  gain: number;
  loss: number;
  history: TimestampedValue[];
}

export interface EnergyData {
  total: number;
  lastPowerTimestamp: number | null;
  lastHRTimestamp: number | null;
}

export interface Lap {
  number: number;
  startTime: number;
  endTime: number | null;
  distance: number;
  avgPower: number | null;
  avgHeartrate: number | null;
  avgCadence: number | null;
  avgSpeed: number | null;
}
```

#### 2.2 Type the onChange callbacks

```typescript
// Current
private _onChange: ((state: any) => void)[] = [];

// Fixed
type StateChangeCallback = (state: MeasurementsStateData) => void;
private _onChange: StateChangeCallback[] = [];

// Update method signatures
public onChange(callback: StateChangeCallback): () => void {
  this._onChange.push(callback);
  return () => {
    const index = this._onChange.indexOf(callback);
    if (index !== -1) {
      this._onChange.splice(index, 1);
    }
  };
}

private _notifyChange(): void {
  const state = this.toJSON();
  for (const callback of this._onChange) {
    try {
      callback(state);
    } catch (error) {
      console.error('State change callback error:', error);
    }
  }
}
```

#### 2.3 Type ConnectionsState

**File: `packages/client/src/state/connections.ts`**

```typescript
export interface SensorConnection {
  type: SensorType;
  name: string;
  connected: boolean;
  lastSeen: number | null;
  batteryLevel: number | null;
  signal: 'strong' | 'medium' | 'weak' | null;
}

export type SensorType =
  | 'power'
  | 'heartrate'
  | 'cadence'
  | 'speed'
  | 'treadmill'
  | 'gps';

export interface ConnectionsStateData {
  sensors: Map<SensorType, SensorConnection>;
  isScanning: boolean;
  lastScanTime: number | null;
}

export class ConnectionsState {
  private _sensors: Map<SensorType, SensorConnection> = new Map();
  private _onChange: ((state: ConnectionsStateData) => void)[] = [];

  public getSensor(type: SensorType): SensorConnection | undefined {
    return this._sensors.get(type);
  }

  public updateSensor(type: SensorType, update: Partial<SensorConnection>): void {
    const existing = this._sensors.get(type) || this.createDefaultSensor(type);
    this._sensors.set(type, { ...existing, ...update });
    this._notifyChange();
  }

  private createDefaultSensor(type: SensorType): SensorConnection {
    return {
      type,
      name: '',
      connected: false,
      lastSeen: null,
      batteryLevel: null,
      signal: null,
    };
  }
}
```

---

### Phase 3: Service Type Safety

**Priority: HIGH**

#### 3.1 Type GPS Factory

**File: `packages/client/src/services/gps/factory.ts`**

```typescript
// Current (problematic)
export function createGPSService(): any {
  // ...
}

// Fixed
export interface GPSService {
  start(): Promise<void>;
  stop(): void;
  getCurrentPosition(): Promise<GPSPosition>;
  watchPosition(callback: (position: GPSPosition) => void): () => void;
  isSupported(): boolean;
  getPermissionStatus(): Promise<PermissionState>;
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export function createGPSService(): GPSService {
  if (isNativePlatform()) {
    return new NativeGPSService();
  }
  return new WebGPSService();
}
```

#### 3.2 Type Bluetooth Services

**File: `packages/client/src/services/bluetooth/types.ts`**

```typescript
export interface BluetoothSensor {
  id: string;
  name: string;
  type: SensorType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  onData(callback: SensorDataCallback): () => void;
  onDisconnect(callback: () => void): () => void;
  getBatteryLevel(): Promise<number | null>;
}

export type SensorDataCallback = (data: SensorData) => void;

export type SensorData =
  | PowerData
  | HeartrateData
  | CadenceData
  | SpeedData
  | TreadmillData;

export interface PowerData {
  type: 'power';
  timestamp: number;
  power: number;
  cadence?: number;
  leftRightBalance?: number;
  pedalSmoothness?: number;
  torqueEffectiveness?: number;
}

export interface HeartrateData {
  type: 'heartrate';
  timestamp: number;
  heartrate: number;
  rrIntervals?: number[];
  contactDetected?: boolean;
}

export interface CadenceData {
  type: 'cadence';
  timestamp: number;
  cadence: number;
  crankRevolutions?: number;
}

export interface SpeedData {
  type: 'speed';
  timestamp: number;
  speed: number;
  wheelRevolutions?: number;
}

export interface TreadmillData {
  type: 'treadmill';
  timestamp: number;
  speed: number;
  incline?: number;
  distance?: number;
  heartrate?: number;
}
```

#### 3.3 Type StreamManager

**File: `packages/client/src/services/stream/manager.ts`**

```typescript
// Current (problematic)
private _pollInterval: any;

// Fixed
private _pollInterval: ReturnType<typeof setInterval> | null = null;

// Or more explicitly
private _pollInterval: number | NodeJS.Timeout | null = null;
```

---

### Phase 4: DataFieldsManager Type Safety

**Priority: MEDIUM**

#### 4.1 Define settings types

**File: `packages/client/src/data-fields/types.ts`**

```typescript
export interface UserSettings {
  ftp: number;
  maxHeartrate: number;
  restingHeartrate: number;
  weight: number; // kg
  height: number; // cm
  age: number;
  gender: 'male' | 'female' | 'other';

  // Display preferences
  units: 'metric' | 'imperial';
  dateFormat: 'ISO' | 'US' | 'EU';

  // Power zones (as percentage of FTP)
  powerZones: ZoneDefinition[];

  // Heart rate zones (as percentage of max HR)
  heartrateZones: ZoneDefinition[];
}

export interface ZoneDefinition {
  name: string;
  min: number; // percentage
  max: number; // percentage
  color: string;
}

export interface WorkoutSettings {
  autoLap: boolean;
  lapDistance: number; // meters
  autoPause: boolean;
  autoPauseSpeed: number; // m/s

  // Display settings
  screens: ScreenConfiguration[];
  activeScreen: number;

  // Audio cues
  lapAudio: boolean;
  zoneChangeAudio: boolean;
}

export interface ScreenConfiguration {
  id: string;
  name: string;
  fields: FieldConfiguration[];
  layout: 'grid' | 'list' | 'custom';
}

export interface FieldConfiguration {
  fieldId: string;
  position: number;
  size: 'small' | 'medium' | 'large';
}

// Default settings factory
export function createDefaultUserSettings(): UserSettings {
  return {
    ftp: 200,
    maxHeartrate: 190,
    restingHeartrate: 60,
    weight: 75,
    height: 175,
    age: 30,
    gender: 'other',
    units: 'metric',
    dateFormat: 'ISO',
    powerZones: DEFAULT_POWER_ZONES,
    heartrateZones: DEFAULT_HR_ZONES,
  };
}

const DEFAULT_POWER_ZONES: ZoneDefinition[] = [
  { name: 'Recovery', min: 0, max: 55, color: '#808080' },
  { name: 'Endurance', min: 55, max: 75, color: '#0000FF' },
  { name: 'Tempo', min: 75, max: 90, color: '#00FF00' },
  { name: 'Threshold', min: 90, max: 105, color: '#FFFF00' },
  { name: 'VO2max', min: 105, max: 120, color: '#FFA500' },
  { name: 'Anaerobic', min: 120, max: 150, color: '#FF0000' },
  { name: 'Neuromuscular', min: 150, max: 1000, color: '#800080' },
];
```

#### 4.2 Update DataFieldsManager

**File: `packages/client/src/data-fields/manager.ts`**

```typescript
// Current (problematic)
private _userSettings: any;
private _workoutSettings: any;

// Fixed
import { UserSettings, WorkoutSettings, createDefaultUserSettings } from './types.js';

private _userSettings: UserSettings = createDefaultUserSettings();
private _workoutSettings: WorkoutSettings | null = null;

public setUserSettings(settings: Partial<UserSettings>): void {
  this._userSettings = { ...this._userSettings, ...settings };
  this._recalculateZones();
}

public getUserSettings(): UserSettings {
  return { ...this._userSettings };
}
```

---

### Phase 5: API Client Type Safety

**Priority: HIGH**

#### 5.1 Define API response types

**File: `packages/client/src/api/types.ts`**

```typescript
// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Workout API types
export interface WorkoutApiResponse {
  id: string;
  userId: string;
  status: WorkoutStatus;
  name: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  summary: WorkoutSummary | null;
  telemetryCount: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkoutStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR';

export interface WorkoutSummary {
  duration: number;
  distance?: number;
  avgPower?: number;
  maxPower?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgHeartrate?: number;
  maxHeartrate?: number;
  normalizedPower?: number;
  intensityFactor?: number;
  tss?: number;
  calories?: number;
  elevationGain?: number;
}

export interface CreateWorkoutRequest {
  name?: string;
  settings?: WorkoutSettings;
}

export interface UpdateWorkoutRequest {
  name?: string;
  status?: WorkoutStatus;
  endTime?: string;
  summary?: WorkoutSummary;
}

// Stream API types
export interface StreamMessage {
  id: string;
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

export interface StreamInfo {
  name: string;
  length: number;
  firstEntry: string | null;
  lastEntry: string | null;
}
```

#### 5.2 Type workoutClient

**File: `packages/client/src/api/workoutClient.ts`**

```typescript
import type {
  WorkoutApiResponse,
  CreateWorkoutRequest,
  UpdateWorkoutRequest,
  ApiError,
} from './types.js';

export class WorkoutClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async create(request: CreateWorkoutRequest): Promise<WorkoutApiResponse> {
    const response = await fetch(`${this.baseUrl}/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json() as Promise<WorkoutApiResponse>;
  }

  async getById(id: string): Promise<WorkoutApiResponse> {
    const response = await fetch(`${this.baseUrl}/workouts/${id}`);

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json() as Promise<WorkoutApiResponse>;
  }

  async update(id: string, request: UpdateWorkoutRequest): Promise<WorkoutApiResponse> {
    const response = await fetch(`${this.baseUrl}/workouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json() as Promise<WorkoutApiResponse>;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workouts/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }
  }

  async list(options: {
    limit?: number;
    offset?: number;
    status?: WorkoutStatus;
  } = {}): Promise<WorkoutApiResponse[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.status) params.set('status', options.status);

    const response = await fetch(`${this.baseUrl}/workouts?${params}`);

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json() as Promise<WorkoutApiResponse[]>;
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const body = await response.json();
      return {
        status: response.status,
        message: body.error || body.message || 'Unknown error',
        code: body.code,
        details: body.details,
      };
    } catch {
      return {
        status: response.status,
        message: response.statusText || 'Unknown error',
      };
    }
  }
}

export const workoutClient = new WorkoutClient();
```

---

### Phase 6: Component Type Safety

**Priority: MEDIUM**

#### 6.1 Type Web Component attributes

**File: `packages/client/src/components/types.ts`**

```typescript
/**
 * Base interface for typed component attributes
 */
export interface ComponentAttributes {
  [key: string]: string | undefined;
}

/**
 * MetricDisplay component attributes
 */
export interface MetricDisplayAttributes extends ComponentAttributes {
  label: string;
  value: string;
  unit?: string;
  zone?: string;
  connected?: 'true' | 'false';
  size?: 'small' | 'medium' | 'large';
}

/**
 * PowerGauge component attributes
 */
export interface PowerGaugeAttributes extends ComponentAttributes {
  value: string;
  ftp: string;
  min?: string;
  max?: string;
  showZones?: 'true' | 'false';
}

/**
 * ZoneGauge component attributes
 */
export interface ZoneGaugeAttributes extends ComponentAttributes {
  zone: string;
  label?: string;
  showLabel?: 'true' | 'false';
}

/**
 * Helper to parse boolean attributes
 */
export function parseBooleanAttribute(value: string | null): boolean {
  return value === 'true' || value === '';
}

/**
 * Helper to parse number attributes with fallback
 */
export function parseNumberAttribute(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}
```

#### 6.2 Type BaseComponent

**File: `packages/client/src/components/BaseComponent.ts`**

```typescript
export abstract class BaseComponent<
  TAttributes extends ComponentAttributes = ComponentAttributes
> extends HTMLElement {
  protected shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  /**
   * Get typed attribute value
   */
  protected getTypedAttribute<K extends keyof TAttributes>(
    name: K
  ): TAttributes[K] {
    return this.getAttribute(name as string) as TAttributes[K];
  }

  /**
   * Set typed attribute value
   */
  protected setTypedAttribute<K extends keyof TAttributes>(
    name: K,
    value: TAttributes[K]
  ): void {
    if (value === undefined) {
      this.removeAttribute(name as string);
    } else {
      this.setAttribute(name as string, value as string);
    }
  }

  /**
   * Get numeric attribute with fallback
   */
  protected getNumericAttribute(name: string, fallback: number): number {
    return parseNumberAttribute(this.getAttribute(name), fallback);
  }

  /**
   * Get boolean attribute
   */
  protected getBooleanAttribute(name: string): boolean {
    return parseBooleanAttribute(this.getAttribute(name));
  }

  // Abstract methods for subclasses
  protected abstract getStyles(): string;
  protected abstract getTemplate(): string;
  protected abstract setupEventListeners(): void;
  protected onAttributeChanged?(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void;
}
```

---

### Phase 7: ESLint Strict Type Rules

**Priority: HIGH**

#### 7.1 Update ESLint configuration

**File: `packages/client/eslint.config.js`**

```javascript
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // Strict type safety rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Require explicit return types on functions
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],

      // Require explicit types on class members
      '@typescript-eslint/explicit-member-accessibility': ['warn', {
        accessibility: 'explicit',
        overrides: { constructors: 'no-public' },
      }],

      // Prevent accidental type assertions
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'never',
      }],

      // Require proper Promise handling
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/promise-function-async': 'warn',

      // Unused variables (stricter than default)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
];
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/scripts/type-audit.ts` | Audit script for `any` usage |
| `packages/client/src/state/types.ts` | State management types |
| `packages/client/src/services/bluetooth/types.ts` | Bluetooth service types |
| `packages/client/src/data-fields/types.ts` | Settings and configuration types |
| `packages/client/src/api/types.ts` | API response types |
| `packages/client/src/components/types.ts` | Component attribute types |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/client/src/state/measurements.ts` | Add proper types to state |
| `packages/client/src/state/connections.ts` | Add sensor connection types |
| `packages/client/src/services/gps/factory.ts` | Return typed GPSService |
| `packages/client/src/services/stream/manager.ts` | Fix interval type |
| `packages/client/src/data-fields/manager.ts` | Use typed settings |
| `packages/client/src/api/workoutClient.ts` | Add request/response types |
| `packages/client/src/components/BaseComponent.ts` | Add generic type support |
| `packages/client/eslint.config.js` | Add strict type rules |

---

## Testing Requirements

### Type Tests (Compile-time)
- TypeScript compilation with strict mode passes
- No `any` types in production code
- All public APIs have explicit return types

### Unit Tests
- Type guards work correctly
- Attribute parsers handle edge cases
- API clients properly type responses

---

## Migration Strategy

1. **Week 1**: Add type definitions without modifying implementations
2. **Week 2**: Update state management (highest impact)
3. **Week 3**: Update services and API clients
4. **Week 4**: Update components and enable strict ESLint rules

---

## Success Metrics

1. **Zero `any` types** in production code
2. **100% typed public APIs** with explicit return types
3. **ESLint strict rules** passing with no errors
4. **Type coverage** > 95% (measured by typescript-coverage)

---

## Estimated Effort

- Phase 1: 1-2 hours (audit script)
- Phase 2: 4-6 hours (state management)
- Phase 3: 3-4 hours (services)
- Phase 4: 2-3 hours (DataFieldsManager)
- Phase 5: 3-4 hours (API clients)
- Phase 6: 2-3 hours (components)
- Phase 7: 1-2 hours (ESLint config)

**Total: 16-24 hours**
