# Data Fields Improvement Plan

**Date:** January 9, 2026  
**Status:** ✅ Complete  
**Priority:** High (Core UX Feature)
**Completed:** January 10, 2026

---

## Implementation Progress

| Phase | Description | Status | Completion Date |
|-------|-------------|--------|-----------------|
| Phase 1 | Data Field Registry & Core Types | ✅ Complete | Jan 9, 2026 |
| Phase 2 | Data Screen Configuration | ✅ Complete | Jan 9, 2026 |
| Phase 3 | Calculated Data Fields Engine | ✅ Complete | Jan 9, 2026 |
| Phase 4 | UI Components | ✅ Complete | Jan 10, 2026 |
| Phase 5 | Screen Navigation (Integration) | ✅ Complete | Jan 10, 2026 |
| Phase 6 | Persistence | ✅ Complete | Jan 10, 2026 |
| Phase 7 | Advanced Features | ✅ Complete | Jan 10, 2026 |
| Phase 8 | Testing & Polish | ✅ Complete | Jan 10, 2026 |

### Phase 1 Implementation Details

**Completed:** Created complete data field type system and registry

**Files Created:**
- `src/data-fields/types.ts` - Core type definitions (DataFieldDefinition, categories, zones, etc.)
- `src/data-fields/registry.ts` - Central registry with lookup/filter functions
- `src/data-fields/calculators/common.ts` - Shared calculation utilities
- `src/data-fields/definitions/power-fields.ts` - 14 power data fields
- `src/data-fields/definitions/heartrate-fields.ts` - 12 heart rate data fields
- `src/data-fields/definitions/cadence-fields.ts` - 10 cadence data fields
- `src/data-fields/definitions/speed-fields.ts` - 12 speed/pace data fields
- `src/data-fields/definitions/distance-fields.ts` - 3 distance data fields
- `src/data-fields/definitions/time-fields.ts` - 8 time data fields
- `src/data-fields/definitions/elevation-fields.ts` - 8 elevation data fields
- `src/data-fields/index.ts` - Module entry point with auto-registration

**Total Data Fields Implemented:** 67 fields across 7 categories

### Phase 2 Implementation Details

**Completed:** Screen configuration system with utility functions

**Files Created:**
- `src/data-fields/screens.ts` - Screen & profile types with utility functions:
  - `DataFieldSlot`, `DataScreen`, `ActivityProfile` interfaces
  - `ScreenLayout`, `ActivityType` types
  - `DataFieldSettings`, `FieldPreferences` for persistence
  - Utility functions: `createSlot`, `createEmptyScreen`, `createEmptyProfile`
  - Manipulation functions: `addSlotToScreen`, `removeSlotFromScreen`, `updateSlot`, `reorderSlots`
  - Navigation functions: `nextScreen`, `previousScreen`, `setActiveScreenIndex`
  - Validation functions: `validateScreen`, `validateProfile`

- `src/data-fields/defaults.ts` - Default configurations:
  - `DEFAULT_CYCLING_PROFILE` - 5 screens (Main, Power, HR, Climbing, Laps)
  - `DEFAULT_INDOOR_PROFILE` - 4 screens (Main, Power, Training, Zones)
  - `DEFAULT_RUNNING_PROFILE` - 2 screens (Main, Pace)
  - `DEFAULT_SIMPLE_PROFILE` - 1 screen (4-field simple layout)
  - Screen presets: Power Focus, Endurance, Intervals
  - Migration helper: `migrateFromLegacySettings()`

### Phase 3 Implementation Details

**Completed:** Calculation engine for derived data fields

**Files Created:**
- `src/data-fields/CalculationManager.ts` - Manages calculated field updates:
  - Schedules calculations based on `UpdateFrequency`
  - Supports realtime (100ms), second, periodic (5s), and manual updates
  - Event system for field value change notifications
  - Singleton pattern for app-wide access
  - Methods: `start()`, `stop()`, `calculateField()`, `calculateAllFields()`
  - Factory: `createCalculationManager()`, `initGlobalCalculationManager()`

### Phase 4 Implementation Details

**Completed:** Web Component UI system for data field rendering

**Files Created:**
- `src/components/data-fields/DataFieldComponent.ts` - Web Component for single data field:
  - Custom element: `<bpt-data-field>`
  - Shadow DOM with encapsulated styles
  - Attributes: `field-id`, `size`, `value`, `connected`, `highlight`
  - Size variants: small, medium, large, wide, tall, full
  - Zone-based coloring for power and heart rate fields
  - Category accent colors
  - Disconnected sensor state styling
  - Animation support for value highlights
  - Methods: `setFieldId()`, `setValue()`, `setSize()`, `setConnected()`, `flash()`

- `src/components/data-fields/DataScreenComponent.ts` - Web Component for data screens:
  - Custom element: `<bpt-data-screen>`
  - Shadow DOM with CSS Grid layout
  - Layout modes: auto, grid-2, grid-3, grid-4, list, custom
  - Manages collection of DataFieldComponent instances
  - Methods: `setScreen()`, `updateFieldValue()`, `setSensorConnected()`
  - Dynamic field element creation/cleanup

- `src/components/data-fields/ScreenCarouselComponent.ts` - Swipeable screen navigation:
  - Custom element: `<bpt-screen-carousel>`
  - Touch gesture support (swipe left/right)
  - Keyboard navigation (arrow keys)
  - Dot indicator for screen position
  - Screen change event: `screenchange`
  - Methods: `nextScreen()`, `prevScreen()`, `goToScreen()`, `updateFieldValue()`
  - Configurable swipe threshold

- `src/components/data-fields/index.ts` - Module entry point:
  - Auto-registers all custom elements
  - Exports component classes and registration function

- `src/styles/data-fields.css` - Global CSS custom properties:
  - Zone colors (7 power zones, 5 HR zones)
  - Category accent colors
  - Grid utility classes
  - Responsive breakpoints
  - Reduced motion support
  - High contrast mode support

### Phase 5 Implementation Details

**Completed:** Integration layer connecting data fields to MeasurementsState

**Files Created:**
- `src/data-fields/DataFieldsManager.ts` - Main integration orchestrator:
  - Connects MeasurementsState to data field components
  - Real-time sensor data updates (100ms refresh)
  - Manages CalculationManager for derived fields
  - Handles sensor connection states
  - Profile/screen management
  - Methods: `start()`, `stop()`, `setProfile()`, `attachToCarousel()`
  - Factory functions: `createDataFieldsManager()`, `initGlobalDataFieldsManager()`

**Files Modified:**
- `src/components/index.ts` - Added data field component exports
- `src/components/data-fields/index.ts` - Added `registerDataFieldComponents()`
- `src/components/data-fields/ScreenCarouselComponent.ts` - Added `setSensorConnected()`
- `src/data-fields/index.ts` - Added DataFieldsManager exports
- `src/data-fields/types.ts` - Added `icon` property to ActivityProfile
- `src/data-fields/screens.ts` - Consolidated types with types.ts (removed duplicates)

### Phase 6 Implementation Details

**Completed:** LocalStorage persistence for profiles and preferences

**Files Created:**
- `src/data-fields/persistence.ts` - Complete persistence layer:
  - LocalStorage save/load with versioned schema
  - Profile CRUD: `loadProfile()`, `saveProfile()`, `deleteProfile()`
  - Settings management: `loadActiveProfile()`, `setActiveProfile()`
  - Field preferences: `loadFieldPreference()`, `saveFieldPreference()`
  - Export/Import: `exportSettings()`, `importSettings()`, `exportProfile()`, `importProfile()`
  - Reset functions: `resetToDefaults()`, `resetProfileToDefault()`
  - Cross-tab sync: `onStorageChange()` for storage event handling
  - Migration support from legacy settings
  - Settings validation before loading

**Files Modified:**
- `src/data-fields/index.ts` - Added persistence exports (20+ functions)

### Phase 7 Implementation Details

**Completed:** Advanced UI components for field selection and screen editing

**Files Created:**
- `src/components/data-fields/FieldPickerComponent.ts` - Modal for selecting data fields:
  - Custom element: `<bpt-field-picker>`
  - Category filtering and search
  - Field preview with icons and descriptions
  - Size selector for chosen field
  - Events: `select`, `close`

- `src/components/data-fields/ScreenEditorComponent.ts` - Screen configuration editor:
  - Custom element: `<bpt-screen-editor>`
  - Drag-and-drop field reordering
  - Add/remove/edit field slots
  - Screen name and layout editing
  - Integration with FieldPickerComponent
  - Events: `save`, `cancel`

**Files Modified:**
- `src/components/data-fields/index.ts` - Added FieldPicker and ScreenEditor exports

### Phase 8 Implementation Details

**Completed:** Unit tests for core data field modules

**Files Created:**
- `src/data-fields/registry.test.ts` - Registry module tests (20 tests):
  - Registration and unregistration
  - Field lookup (getDataField, hasDataField, getAllDataFields)
  - Category filtering (getFieldsByCategory, getAllCategories, getCategoriesWithCounts)
  - Sensor filtering (getFieldsRequiringSensor, getFieldsRequiringGps, getFieldsRequiringWorkout)
  - Search functionality
  - Batch field retrieval (getFieldsByIds)

- `src/data-fields/screens.test.ts` - Screen configuration tests (25 tests):
  - ID generation (generateSlotId, generateScreenId, generateProfileId)
  - Slot management (createSlot, addSlotToScreen, removeSlotFromScreen, updateSlot, reorderSlots)
  - Screen management (createEmptyScreen, addScreenToProfile, removeScreenFromProfile)
  - Profile management (createEmptyProfile)
  - Navigation (getActiveScreen, setActiveScreenIndex, nextScreen, previousScreen)
  - Validation (validateScreen, validateProfile)

- `src/data-fields/persistence.test.ts` - Persistence layer tests (22 tests):
  - Settings load/save (loadDataFieldSettings, saveDataFieldSettings)
  - Profile management (loadProfile, saveProfile, deleteProfile, setActiveProfile)
  - Screen index (saveActiveScreenIndex)
  - Reset (resetToDefaults)
  - Export/Import (exportSettings, importSettings, exportProfile, importProfile)
  - LocalStorage polyfill for Node.js test environment

**Test Results:**
- Total: 76 tests
- Passed: 76
- Failed: 0
- TypeScript: ✅ No errors

---

## Overview

This document outlines the plan to transform BPT's current basic metrics display into a fully customizable **Data Fields** system, similar to Garmin/Wahoo bike computers and fitness watches.

### Terminology Change

| Current Term | New Term | Industry Standard |
|--------------|----------|-------------------|
| Metrics | Data Fields | ✅ Garmin, Wahoo, Hammerhead |
| Metric Group | Data Field Slot | ✅ |
| Dashboard Display | Data Screens / Activity Profiles | ✅ |
| Settings → Display | Data Field Configuration | ✅ |

---

## Current State Analysis

### Existing Data Fields (8 total)
| Field | Source | Type |
|-------|--------|------|
| Power | Bluetooth sensor | Real-time |
| Cadence | Bluetooth sensor | Real-time |
| Heart Rate | Bluetooth sensor | Real-time |
| Speed | GPS/calculated | Real-time |
| Distance | GPS accumulated | Accumulated |
| Altitude | GPS | Real-time |
| Treadmill Speed | FTMS sensor | Real-time |
| Incline | FTMS sensor | Real-time |

### Current Limitations
1. ❌ Fixed data fields - cannot add/remove/reorder
2. ❌ No calculated fields (averages, lap data, etc.)
3. ❌ Single screen layout only
4. ❌ No field size options (all same size)
5. ❌ No data field categories
6. ❌ Cannot duplicate fields (e.g., show current AND average power)

---

## Proposed Data Fields Architecture

### Data Field Categories

```
📊 DATA FIELD CATEGORIES
├── ⚡ Power
│   ├── Power (current)
│   ├── Power (3s avg)
│   ├── Power (10s avg)
│   ├── Power (30s avg)
│   ├── Power (lap avg)
│   ├── Power (avg)
│   ├── Power (max)
│   ├── Power (normalized - NP)
│   ├── Power Zone
│   ├── Power % of FTP
│   ├── TSS (Training Stress Score)
│   ├── IF (Intensity Factor)
│   ├── Kilojoules
│   └── W/kg
│
├── 🔄 Cadence
│   ├── Cadence (current)
│   ├── Cadence (avg)
│   ├── Cadence (max)
│   └── Cadence (lap avg)
│
├── ❤️ Heart Rate
│   ├── Heart Rate (current)
│   ├── Heart Rate (avg)
│   ├── Heart Rate (max)
│   ├── Heart Rate (lap avg)
│   ├── HR Zone
│   ├── HR % of Max
│   └── HR Recovery
│
├── 🚴 Speed & Pace
│   ├── Speed (current)
│   ├── Speed (avg)
│   ├── Speed (max)
│   ├── Speed (lap avg)
│   ├── Speed (last km avg)
│   ├── Pace (min/km)
│   └── Pace (min/mi)
│
├── 📍 Distance
│   ├── Distance (total)
│   ├── Distance (lap)
│   ├── Distance (to destination)
│   └── Distance (remaining in km)
│
├── ⛰️ Elevation
│   ├── Altitude (current)
│   ├── Elevation Gain (total)
│   ├── Elevation Loss (total)
│   ├── Elevation Gain (lap)
│   ├── Grade (%)
│   └── VAM (m/hour)
│
├── ⏱️ Time
│   ├── Time (elapsed)
│   ├── Time (moving)
│   ├── Time (stopped)
│   ├── Time (lap)
│   ├── Time (last lap)
│   ├── Time of Day
│   ├── Sunrise
│   ├── Sunset
│   └── ETA (to destination)
│
├── 🏁 Laps
│   ├── Lap Count
│   ├── Lap Time (current)
│   ├── Lap Time (last)
│   ├── Lap Distance
│   ├── Lap Power (avg)
│   ├── Lap HR (avg)
│   ├── Lap Cadence (avg)
│   └── Lap Speed (avg)
│
├── 🌡️ Environment
│   ├── Temperature
│   ├── Humidity
│   ├── Wind Speed
│   ├── Wind Direction
│   └── Barometric Pressure
│
├── 🔋 Device
│   ├── Phone Battery
│   ├── Sensor Battery (HR)
│   ├── Sensor Battery (Power)
│   └── GPS Signal Strength
│
├── 📈 Charts (Special Fields)
│   ├── Power Graph
│   ├── HR Graph
│   ├── Elevation Profile
│   ├── Speed Graph
│   └── Zone Distribution
│
└── 🗺️ Map (Special Field)
    └── Route Map
```

### Total Proposed Data Fields: ~70+

---

## Implementation Plan

### Phase 1: Data Field Registry & Core Types (3-4 days)

#### 1.1 Create Data Field Type System

```typescript
// src/data-fields/types.ts

/** Data field category for organization */
export type DataFieldCategory = 
  | 'power' 
  | 'cadence' 
  | 'heartrate' 
  | 'speed' 
  | 'distance' 
  | 'elevation' 
  | 'time' 
  | 'laps' 
  | 'environment'
  | 'device'
  | 'charts'
  | 'map';

/** Data field size options */
export type DataFieldSize = 
  | 'small'    // 1x1 - compact, value only
  | 'medium'   // 1x1 - label + value
  | 'large'    // 2x1 - label + large value
  | 'wide'     // 2x1 - for charts/graphs
  | 'tall'     // 1x2 - vertical layout
  | 'full';    // 2x2 - maps, large charts

/** Data source type */
export type DataSourceType = 
  | 'sensor'      // Direct from Bluetooth sensor
  | 'gps'         // From GPS/location
  | 'calculated'  // Derived from other data
  | 'system'      // Device info
  | 'external';   // Weather API, etc.

/** Update frequency */
export type UpdateFrequency = 
  | 'realtime'    // Every measurement (100ms)
  | 'second'      // Once per second
  | 'periodic'    // Every few seconds
  | 'on-change'   // Only when value changes
  | 'manual';     // User triggered

/** Data field definition */
export interface DataFieldDefinition {
  id: string;                        // Unique identifier: 'power-current'
  name: string;                      // Display name: 'Power'
  shortName: string;                 // Abbreviated: 'PWR'
  category: DataFieldCategory;
  description: string;
  unit: string | null;               // 'W', 'bpm', 'km/h', null for unitless
  unitImperial?: string;             // 'mph' for speed
  sourceType: DataSourceType;
  updateFrequency: UpdateFrequency;
  defaultSize: DataFieldSize;
  supportedSizes: DataFieldSize[];
  icon: string;                      // Emoji or icon class
  requiresSensor?: string[];         // ['power'] - required sensors
  requiresGps?: boolean;
  requiresWorkoutActive?: boolean;
  formatter: (value: number | null, settings: UserSettings) => string;
  calculator?: DataFieldCalculator;  // For calculated fields
  colorizer?: DataFieldColorizer;    // For zone coloring
}

/** Calculator function for derived fields */
export type DataFieldCalculator = (
  measurements: MeasurementsState,
  workoutState: WorkoutState,
  settings: UserSettings
) => number | null;

/** Colorizer for zone-based coloring */
export type DataFieldColorizer = (
  value: number | null,
  settings: UserSettings
) => { bg: string; text: string; border: string } | null;
```

#### 1.2 Create Data Field Registry

```typescript
// src/data-fields/registry.ts

export const DATA_FIELD_REGISTRY: Map<string, DataFieldDefinition> = new Map();

// Register all data fields
export function registerDataField(field: DataFieldDefinition): void {
  DATA_FIELD_REGISTRY.set(field.id, field);
}

// Get field by ID
export function getDataField(id: string): DataFieldDefinition | undefined {
  return DATA_FIELD_REGISTRY.get(id);
}

// Get fields by category
export function getFieldsByCategory(category: DataFieldCategory): DataFieldDefinition[] {
  return Array.from(DATA_FIELD_REGISTRY.values())
    .filter(f => f.category === category);
}

// Get all categories with their fields
export function getAllCategories(): Map<DataFieldCategory, DataFieldDefinition[]> {
  const categories = new Map<DataFieldCategory, DataFieldDefinition[]>();
  for (const field of DATA_FIELD_REGISTRY.values()) {
    const list = categories.get(field.category) || [];
    list.push(field);
    categories.set(field.category, list);
  }
  return categories;
}
```

#### 1.3 Define All Data Fields

```typescript
// src/data-fields/definitions/power-fields.ts

import { registerDataField } from '../registry.js';
import { calculateNormalizedPower, calculateTSS } from '../calculators/power.js';

// Power - Current
registerDataField({
  id: 'power-current',
  name: 'Power',
  shortName: 'PWR',
  category: 'power',
  description: 'Current power output from power meter',
  unit: 'W',
  sourceType: 'sensor',
  updateFrequency: 'realtime',
  defaultSize: 'medium',
  supportedSizes: ['small', 'medium', 'large'],
  icon: '⚡',
  requiresSensor: ['power'],
  formatter: (value) => value !== null ? Math.round(value).toString() : '--',
  colorizer: powerZoneColorizer,
});

// Power - 3 Second Average
registerDataField({
  id: 'power-3s',
  name: 'Power (3s)',
  shortName: '3s PWR',
  category: 'power',
  description: '3-second rolling average power',
  unit: 'W',
  sourceType: 'calculated',
  updateFrequency: 'second',
  defaultSize: 'medium',
  supportedSizes: ['small', 'medium', 'large'],
  icon: '⚡',
  requiresSensor: ['power'],
  calculator: (m) => calculateRollingAverage(m.power, 3000),
  formatter: (value) => value !== null ? Math.round(value).toString() : '--',
  colorizer: powerZoneColorizer,
});

// Power - Normalized (NP)
registerDataField({
  id: 'power-normalized',
  name: 'Normalized Power',
  shortName: 'NP',
  category: 'power',
  description: 'Normalized Power (accounts for variability)',
  unit: 'W',
  sourceType: 'calculated',
  updateFrequency: 'periodic',
  defaultSize: 'medium',
  supportedSizes: ['small', 'medium', 'large'],
  icon: '⚡',
  requiresSensor: ['power'],
  requiresWorkoutActive: true,
  calculator: calculateNormalizedPower,
  formatter: (value) => value !== null ? Math.round(value).toString() : '--',
});

// ... more power fields
```

---

### Phase 2: Data Screen Configuration (4-5 days)

#### 2.1 Data Screen Types

```typescript
// src/data-fields/screens.ts

/** A configured data field slot */
export interface DataFieldSlot {
  id: string;              // Unique slot ID
  fieldId: string;         // Reference to DataFieldDefinition.id
  size: DataFieldSize;
  position: number;        // Order in the grid
}

/** A complete data screen configuration */
export interface DataScreen {
  id: string;
  name: string;
  icon: string;
  slots: DataFieldSlot[];
  layout: ScreenLayout;
}

/** Screen layout options */
export type ScreenLayout = 
  | 'auto'       // Automatic grid based on field count
  | 'grid-2'     // 2 columns
  | 'grid-3'     // 3 columns
  | 'grid-4'     // 4 columns
  | 'list'       // Vertical list
  | 'custom';    // User-defined positions

/** Activity profile with multiple screens */
export interface ActivityProfile {
  id: string;
  name: string;
  activityType: 'cycling' | 'running' | 'indoor' | 'custom';
  screens: DataScreen[];
  activeScreenIndex: number;
}
```

#### 2.2 Default Screen Configurations

```typescript
// src/data-fields/defaults.ts

export const DEFAULT_CYCLING_SCREENS: DataScreen[] = [
  {
    id: 'cycling-main',
    name: 'Main',
    icon: '🚴',
    layout: 'auto',
    slots: [
      { id: 's1', fieldId: 'power-current', size: 'large', position: 1 },
      { id: 's2', fieldId: 'heartrate-current', size: 'medium', position: 2 },
      { id: 's3', fieldId: 'cadence-current', size: 'medium', position: 3 },
      { id: 's4', fieldId: 'speed-current', size: 'medium', position: 4 },
      { id: 's5', fieldId: 'distance-total', size: 'medium', position: 5 },
      { id: 's6', fieldId: 'time-elapsed', size: 'medium', position: 6 },
    ],
  },
  {
    id: 'cycling-power',
    name: 'Power',
    icon: '⚡',
    layout: 'auto',
    slots: [
      { id: 's1', fieldId: 'power-current', size: 'large', position: 1 },
      { id: 's2', fieldId: 'power-3s', size: 'medium', position: 2 },
      { id: 's3', fieldId: 'power-avg', size: 'medium', position: 3 },
      { id: 's4', fieldId: 'power-normalized', size: 'medium', position: 4 },
      { id: 's5', fieldId: 'power-max', size: 'medium', position: 5 },
      { id: 's6', fieldId: 'power-zone', size: 'medium', position: 6 },
    ],
  },
  {
    id: 'cycling-map',
    name: 'Map',
    icon: '🗺️',
    layout: 'custom',
    slots: [
      { id: 's1', fieldId: 'map-route', size: 'full', position: 1 },
      { id: 's2', fieldId: 'speed-current', size: 'small', position: 2 },
      { id: 's3', fieldId: 'distance-total', size: 'small', position: 3 },
    ],
  },
];

export const DEFAULT_INDOOR_SCREENS: DataScreen[] = [
  {
    id: 'indoor-main',
    name: 'Indoor',
    icon: '🏠',
    layout: 'auto',
    slots: [
      { id: 's1', fieldId: 'power-current', size: 'large', position: 1 },
      { id: 's2', fieldId: 'heartrate-current', size: 'medium', position: 2 },
      { id: 's3', fieldId: 'cadence-current', size: 'medium', position: 3 },
      { id: 's4', fieldId: 'time-elapsed', size: 'medium', position: 4 },
      { id: 's5', fieldId: 'power-avg', size: 'medium', position: 5 },
      { id: 's6', fieldId: 'kilojoules', size: 'medium', position: 6 },
    ],
  },
];
```

---

### Phase 3: Calculated Data Fields Engine (3-4 days)

#### 3.1 Calculator Functions

```typescript
// src/data-fields/calculators/power.ts

import type { MeasurementsState } from '../../measurements-state.js';
import type { WorkoutState } from '../../state/WorkoutState.js';

/**
 * Calculate rolling average for a measurement array
 */
export function calculateRollingAverage(
  measurements: Array<{ timestamp: number; value: number }>,
  windowMs: number
): number | null {
  if (measurements.length === 0) return null;
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const windowValues = measurements.filter(m => m.timestamp >= windowStart);
  if (windowValues.length === 0) return null;
  
  const sum = windowValues.reduce((acc, m) => acc + m.value, 0);
  return sum / windowValues.length;
}

/**
 * Calculate Normalized Power (NP)
 * 30-second rolling average, raised to 4th power, averaged, then 4th root
 */
export function calculateNormalizedPower(
  measurements: MeasurementsState,
  _workoutState: WorkoutState
): number | null {
  const powerData = measurements.power;
  if (powerData.length < 30) return null;
  
  // Get 30-second rolling averages
  const thirtySecondAverages: number[] = [];
  const windowSize = 30000; // 30 seconds
  
  for (let i = 0; i < powerData.length; i++) {
    const windowEnd = powerData[i].timestamp;
    const windowStart = windowEnd - windowSize;
    
    const windowValues = powerData.filter(
      p => p.timestamp >= windowStart && p.timestamp <= windowEnd
    );
    
    if (windowValues.length > 0) {
      const avg = windowValues.reduce((s, p) => s + p.value, 0) / windowValues.length;
      thirtySecondAverages.push(avg);
    }
  }
  
  if (thirtySecondAverages.length === 0) return null;
  
  // Raise to 4th power, average, then 4th root
  const fourthPowers = thirtySecondAverages.map(v => Math.pow(v, 4));
  const avgFourthPower = fourthPowers.reduce((s, v) => s + v, 0) / fourthPowers.length;
  
  return Math.pow(avgFourthPower, 0.25);
}

/**
 * Calculate Training Stress Score (TSS)
 */
export function calculateTSS(
  measurements: MeasurementsState,
  workoutState: WorkoutState,
  ftp: number
): number | null {
  const np = calculateNormalizedPower(measurements, workoutState);
  if (np === null || ftp <= 0) return null;
  
  const durationSeconds = workoutState.elapsedTime / 1000;
  const intensityFactor = np / ftp;
  
  return (durationSeconds * np * intensityFactor) / (ftp * 3600) * 100;
}

/**
 * Calculate W/kg (Watts per kilogram)
 */
export function calculateWPerKg(
  currentPower: number | null,
  weightKg: number
): number | null {
  if (currentPower === null || weightKg <= 0) return null;
  return currentPower / weightKg;
}
```

#### 3.2 Speed/Distance Calculators

```typescript
// src/data-fields/calculators/speed.ts

/**
 * Calculate average speed for current kilometer
 */
export function calculateSpeedThisKm(
  measurements: MeasurementsState,
  totalDistanceKm: number
): number | null {
  const currentKmStart = Math.floor(totalDistanceKm);
  const distanceIntoKm = totalDistanceKm - currentKmStart;
  
  if (distanceIntoKm <= 0) return null;
  
  // Find timestamp when we crossed into this km
  // This requires tracking km splits - need to store these
  
  // Simplified: calculate from recent GPS data
  const gpsData = measurements.gps;
  if (gpsData.length < 2) return null;
  
  // Calculate from accumulated distance in this km
  // ... implementation
  
  return null; // Placeholder
}

/**
 * Calculate VAM (Vertical Ascent Meters per hour)
 */
export function calculateVAM(
  elevationGainMeters: number,
  timeSeconds: number
): number | null {
  if (timeSeconds <= 0) return null;
  return (elevationGainMeters / timeSeconds) * 3600;
}
```

---

### Phase 4: Data Field UI Components (4-5 days)

#### 4.1 Enhanced Data Field Component

```typescript
// src/components/DataField.ts

/**
 * Data Field Web Component
 * 
 * Displays a single data field with configurable size, styling, and behavior.
 */
export class DataField extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['field-id', 'size', 'connected', 'value'];
  }
  
  private fieldDefinition: DataFieldDefinition | null = null;
  private currentValue: number | null = null;
  
  connectedCallback(): void {
    this.render();
  }
  
  attributeChangedCallback(name: string, _old: string, value: string): void {
    if (name === 'field-id') {
      this.fieldDefinition = getDataField(value) || null;
      this.render();
    } else if (name === 'value') {
      this.updateValue(value);
    }
  }
  
  private render(): void {
    if (!this.fieldDefinition) {
      this.innerHTML = '<span class="error">Unknown field</span>';
      return;
    }
    
    const size = this.getAttribute('size') || this.fieldDefinition.defaultSize;
    
    this.innerHTML = `
      <div class="data-field data-field--${size}" data-category="${this.fieldDefinition.category}">
        <div class="data-field__header">
          <span class="data-field__icon">${this.fieldDefinition.icon}</span>
          <span class="data-field__label">${this.fieldDefinition.name}</span>
        </div>
        <div class="data-field__value">
          <span class="data-field__number">--</span>
          ${this.fieldDefinition.unit ? `<span class="data-field__unit">${this.fieldDefinition.unit}</span>` : ''}
        </div>
      </div>
    `;
  }
  
  private updateValue(rawValue: string): void {
    const numValue = rawValue === '--' ? null : parseFloat(rawValue);
    this.currentValue = numValue;
    
    const valueEl = this.querySelector('.data-field__number');
    if (valueEl && this.fieldDefinition) {
      valueEl.textContent = this.fieldDefinition.formatter(numValue, getUserSettings());
      
      // Apply zone coloring if available
      if (this.fieldDefinition.colorizer) {
        const colors = this.fieldDefinition.colorizer(numValue, getUserSettings());
        if (colors) {
          this.style.setProperty('--field-bg', colors.bg);
          this.style.setProperty('--field-text', colors.text);
          this.style.setProperty('--field-border', colors.border);
        }
      }
    }
  }
}

customElements.define('bpt-data-field', DataField);
```

#### 4.2 Data Screen Component

```typescript
// src/components/DataScreen.ts

/**
 * Data Screen Component
 * 
 * Renders a complete data screen with multiple data fields.
 */
export class DataScreenComponent extends HTMLElement {
  private screen: DataScreen | null = null;
  private fieldElements: Map<string, DataField> = new Map();
  
  public setScreen(screen: DataScreen): void {
    this.screen = screen;
    this.render();
  }
  
  private render(): void {
    if (!this.screen) return;
    
    this.className = `data-screen data-screen--${this.screen.layout}`;
    this.innerHTML = '';
    this.fieldElements.clear();
    
    for (const slot of this.screen.slots) {
      const fieldEl = document.createElement('bpt-data-field') as DataField;
      fieldEl.setAttribute('field-id', slot.fieldId);
      fieldEl.setAttribute('size', slot.size);
      fieldEl.style.order = String(slot.position);
      
      this.appendChild(fieldEl);
      this.fieldElements.set(slot.id, fieldEl);
    }
  }
  
  public updateFieldValue(slotId: string, value: number | null): void {
    const fieldEl = this.fieldElements.get(slotId);
    if (fieldEl) {
      fieldEl.setAttribute('value', value !== null ? String(value) : '--');
    }
  }
}

customElements.define('bpt-data-screen', DataScreenComponent);
```

---

### Phase 5: Screen Navigation & Swipe (2-3 days)

#### 5.1 Screen Carousel

```typescript
// src/components/ScreenCarousel.ts

/**
 * Screen Carousel Component
 * 
 * Allows swiping between multiple data screens.
 */
export class ScreenCarousel extends HTMLElement {
  private screens: DataScreen[] = [];
  private activeIndex = 0;
  private touchStartX = 0;
  private touchEndX = 0;
  
  connectedCallback(): void {
    this.setupTouchHandlers();
    this.setupKeyboardNav();
  }
  
  private setupTouchHandlers(): void {
    this.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    });
    
    this.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    });
  }
  
  private handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.nextScreen();
      } else {
        this.previousScreen();
      }
    }
  }
  
  public nextScreen(): void {
    if (this.activeIndex < this.screens.length - 1) {
      this.activeIndex++;
      this.renderActiveScreen();
    }
  }
  
  public previousScreen(): void {
    if (this.activeIndex > 0) {
      this.activeIndex--;
      this.renderActiveScreen();
    }
  }
  
  private renderActiveScreen(): void {
    // Animate transition and render new screen
    this.dispatchEvent(new CustomEvent('screen-change', {
      detail: { index: this.activeIndex, screen: this.screens[this.activeIndex] }
    }));
  }
}

customElements.define('bpt-screen-carousel', ScreenCarousel);
```

#### 5.2 Screen Indicator Dots

```typescript
// src/components/ScreenIndicator.ts

/**
 * Dot indicator for screen position
 */
export class ScreenIndicator extends HTMLElement {
  private totalScreens = 0;
  private activeIndex = 0;
  
  public update(total: number, active: number): void {
    this.totalScreens = total;
    this.activeIndex = active;
    this.render();
  }
  
  private render(): void {
    this.innerHTML = Array(this.totalScreens)
      .fill(0)
      .map((_, i) => `
        <button 
          class="screen-dot ${i === this.activeIndex ? 'screen-dot--active' : ''}"
          aria-label="Go to screen ${i + 1}"
          data-index="${i}"
        ></button>
      `)
      .join('');
  }
}

customElements.define('bpt-screen-indicator', ScreenIndicator);
```

---

### Phase 6: Data Field Customization UI (5-6 days)

#### 6.1 Field Picker Modal

```typescript
// src/ui/FieldPicker.ts

/**
 * Modal for selecting a data field
 */
export class FieldPicker {
  private modal: HTMLElement;
  private onSelect: (fieldId: string) => void;
  
  public show(currentFieldId: string | null, onSelect: (fieldId: string) => void): void {
    this.onSelect = onSelect;
    this.renderModal(currentFieldId);
    this.modal.showModal();
  }
  
  private renderModal(currentFieldId: string | null): void {
    const categories = getAllCategories();
    
    this.modal.innerHTML = `
      <div class="field-picker">
        <header class="field-picker__header">
          <h2>Select Data Field</h2>
          <button class="close-btn" aria-label="Close">✕</button>
        </header>
        
        <div class="field-picker__search">
          <input type="search" placeholder="Search fields..." aria-label="Search data fields">
        </div>
        
        <div class="field-picker__categories">
          ${Array.from(categories.entries()).map(([cat, fields]) => `
            <details class="field-category" open>
              <summary class="field-category__header">
                ${getCategoryIcon(cat)} ${getCategoryName(cat)} (${fields.length})
              </summary>
              <div class="field-category__list">
                ${fields.map(field => `
                  <button 
                    class="field-option ${field.id === currentFieldId ? 'field-option--selected' : ''}"
                    data-field-id="${field.id}"
                  >
                    <span class="field-option__icon">${field.icon}</span>
                    <div class="field-option__info">
                      <span class="field-option__name">${field.name}</span>
                      <span class="field-option__desc">${field.description}</span>
                    </div>
                    ${field.requiresSensor ? `<span class="field-option__sensor">📡</span>` : ''}
                  </button>
                `).join('')}
              </div>
            </details>
          `).join('')}
        </div>
      </div>
    `;
  }
}
```

#### 6.2 Screen Editor

```typescript
// src/ui/ScreenEditor.ts

/**
 * Drag-and-drop screen layout editor
 */
export class ScreenEditor {
  private screen: DataScreen;
  private container: HTMLElement;
  private fieldPicker: FieldPicker;
  
  public show(screen: DataScreen): void {
    this.screen = { ...screen };
    this.renderEditor();
  }
  
  private renderEditor(): void {
    this.container.innerHTML = `
      <div class="screen-editor">
        <header class="screen-editor__header">
          <input type="text" value="${this.screen.name}" class="screen-name-input">
          <div class="screen-editor__actions">
            <button class="btn-add-field">+ Add Field</button>
            <button class="btn-save">Save</button>
            <button class="btn-cancel">Cancel</button>
          </div>
        </header>
        
        <div class="screen-editor__preview">
          <div class="screen-editor__grid" data-layout="${this.screen.layout}">
            ${this.screen.slots.map(slot => `
              <div class="editor-slot" data-slot-id="${slot.id}" draggable="true">
                <bpt-data-field field-id="${slot.fieldId}" size="${slot.size}"></bpt-data-field>
                <div class="editor-slot__controls">
                  <button class="btn-change" title="Change field">🔄</button>
                  <button class="btn-resize" title="Resize">↔️</button>
                  <button class="btn-remove" title="Remove">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <footer class="screen-editor__footer">
          <label>
            Layout:
            <select class="layout-select">
              <option value="auto">Auto</option>
              <option value="grid-2">2 Columns</option>
              <option value="grid-3">3 Columns</option>
              <option value="grid-4">4 Columns</option>
              <option value="list">List</option>
            </select>
          </label>
        </footer>
      </div>
    `;
    
    this.setupDragDrop();
    this.setupEventListeners();
  }
  
  private setupDragDrop(): void {
    // Implement drag-and-drop reordering
    const slots = this.container.querySelectorAll('.editor-slot');
    slots.forEach(slot => {
      slot.addEventListener('dragstart', this.handleDragStart.bind(this));
      slot.addEventListener('dragover', this.handleDragOver.bind(this));
      slot.addEventListener('drop', this.handleDrop.bind(this));
    });
  }
}
```

---

### Phase 7: Settings Integration (2-3 days)

#### 7.1 Updated Settings Structure

```typescript
// src/config/settings.ts

export interface DataFieldSettings {
  // Activity profiles
  profiles: ActivityProfile[];
  activeProfileId: string;
  
  // Global preferences
  unitSystem: 'metric' | 'imperial';
  
  // Field-specific settings
  fieldPreferences: {
    [fieldId: string]: {
      showInSummary: boolean;
      voiceAnnounce: boolean;
      alertThreshold?: number;
      alertType?: 'above' | 'below';
    };
  };
}

export interface AppSettings {
  // ... existing settings ...
  
  // New data field settings
  dataFields: DataFieldSettings;
}
```

#### 7.2 Settings UI Section

```html
<!-- New settings section for Data Fields -->
<fieldset class="settings-fieldset">
  <legend>📊 Data Fields</legend>
  
  <div class="setting-group">
    <h4>Activity Profile</h4>
    <select id="settingActivityProfile">
      <option value="cycling">Cycling (Outdoor)</option>
      <option value="indoor">Indoor/Trainer</option>
      <option value="running">Running</option>
      <option value="custom">Custom</option>
    </select>
    <button id="editProfileBtn">Edit Screens</button>
  </div>
  
  <div class="setting-group">
    <h4>Units</h4>
    <label>
      <input type="radio" name="units" value="metric" checked> Metric (km, m, kg)
    </label>
    <label>
      <input type="radio" name="units" value="imperial"> Imperial (mi, ft, lb)
    </label>
  </div>
  
  <div class="setting-group">
    <h4>Quick Actions</h4>
    <button id="resetFieldsBtn">Reset to Defaults</button>
    <button id="importFieldsBtn">Import Layout</button>
    <button id="exportFieldsBtn">Export Layout</button>
  </div>
</fieldset>
```

---

### Phase 8: Data Calculations Engine (2-3 days)

#### 8.1 Calculation Manager

```typescript
// src/data-fields/CalculationManager.ts

/**
 * Manages calculated data field updates
 */
export class CalculationManager {
  private calculatedFields: Map<string, number | null> = new Map();
  private updateIntervals: Map<string, number> = new Map();
  
  constructor(
    private measurements: MeasurementsState,
    private workoutState: WorkoutState,
    private settings: UserSettings
  ) {}
  
  public start(): void {
    // Set up update intervals based on field requirements
    for (const [id, field] of DATA_FIELD_REGISTRY) {
      if (field.calculator) {
        const interval = this.getUpdateInterval(field.updateFrequency);
        const timerId = window.setInterval(() => {
          this.calculateField(id, field);
        }, interval);
        this.updateIntervals.set(id, timerId);
      }
    }
  }
  
  public stop(): void {
    for (const timerId of this.updateIntervals.values()) {
      clearInterval(timerId);
    }
    this.updateIntervals.clear();
  }
  
  private calculateField(id: string, field: DataFieldDefinition): void {
    if (!field.calculator) return;
    
    const value = field.calculator(this.measurements, this.workoutState, this.settings);
    this.calculatedFields.set(id, value);
    
    // Dispatch update event
    window.dispatchEvent(new CustomEvent('data-field-update', {
      detail: { fieldId: id, value }
    }));
  }
  
  public getValue(fieldId: string): number | null {
    return this.calculatedFields.get(fieldId) ?? null;
  }
  
  private getUpdateInterval(frequency: UpdateFrequency): number {
    switch (frequency) {
      case 'realtime': return 100;
      case 'second': return 1000;
      case 'periodic': return 5000;
      default: return 1000;
    }
  }
}
```

---

## CSS Styling Plan

### Data Field Sizes

```css
/* src/styles/data-fields.css */

.data-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--field-padding, 8px);
  border-radius: 8px;
  background: var(--field-bg, transparent);
  border-left: 4px solid var(--field-border, transparent);
  transition: all 0.3s ease;
}

/* Size variants */
.data-field--small {
  min-width: 80px;
  min-height: 60px;
}

.data-field--small .data-field__label {
  display: none;
}

.data-field--small .data-field__value {
  font-size: 24px;
}

.data-field--medium {
  min-width: 120px;
  min-height: 100px;
}

.data-field--medium .data-field__value {
  font-size: 36px;
}

.data-field--large {
  min-width: 180px;
  min-height: 140px;
  grid-column: span 2;
}

.data-field--large .data-field__value {
  font-size: 56px;
}

.data-field--wide {
  grid-column: span 2;
  min-height: 120px;
}

.data-field--tall {
  grid-row: span 2;
  min-height: 200px;
}

.data-field--full {
  grid-column: span 2;
  grid-row: span 2;
  min-height: 300px;
}

/* Screen layouts */
.data-screen {
  display: grid;
  gap: 8px;
  padding: 8px;
  height: 100%;
}

.data-screen--grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.data-screen--grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.data-screen--grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.data-screen--auto {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.data-screen--list {
  grid-template-columns: 1fr;
}

/* Screen transition animations */
.screen-carousel {
  overflow: hidden;
  position: relative;
}

.screen-carousel__track {
  display: flex;
  transition: transform 0.3s ease-out;
}

.screen-carousel__slide {
  flex: 0 0 100%;
}
```

---

## File Structure

```
src/
├── data-fields/
│   ├── types.ts                    # Type definitions
│   ├── registry.ts                 # Data field registry
│   ├── defaults.ts                 # Default screen configurations
│   ├── CalculationManager.ts       # Calculation engine
│   ├── definitions/
│   │   ├── index.ts                # Export all field definitions
│   │   ├── power-fields.ts         # Power-related fields
│   │   ├── heartrate-fields.ts     # HR-related fields
│   │   ├── cadence-fields.ts       # Cadence fields
│   │   ├── speed-fields.ts         # Speed/pace fields
│   │   ├── distance-fields.ts      # Distance fields
│   │   ├── elevation-fields.ts     # Altitude/elevation fields
│   │   ├── time-fields.ts          # Time-related fields
│   │   ├── lap-fields.ts           # Lap-specific fields
│   │   ├── environment-fields.ts   # Temperature, etc.
│   │   └── device-fields.ts        # Battery, GPS strength
│   └── calculators/
│       ├── index.ts
│       ├── power.ts                # NP, TSS, IF, kJ
│       ├── speed.ts                # Avg speed, VAM
│       ├── heart-rate.ts           # HR zones, recovery
│       └── common.ts               # Rolling averages, etc.
├── components/
│   ├── DataField.ts                # Single data field component
│   ├── DataScreen.ts               # Full screen of fields
│   ├── ScreenCarousel.ts           # Swipeable screens
│   └── ScreenIndicator.ts          # Dot indicators
├── ui/
│   ├── FieldPicker.ts              # Field selection modal
│   ├── ScreenEditor.ts             # Screen layout editor
│   └── data-fields-settings.ts     # Settings integration
└── styles/
    └── data-fields.css             # Data field styling
```

---

## Implementation Timeline

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 1 | Data Field Registry & Types | 3-4 days | None |
| 2 | Data Screen Configuration | 4-5 days | Phase 1 |
| 3 | Calculated Fields Engine | 3-4 days | Phase 1 |
| 4 | UI Components | 4-5 days | Phase 1, 2 |
| 5 | Screen Navigation | 2-3 days | Phase 4 |
| 6 | Customization UI | 5-6 days | Phase 4, 5 |
| 7 | Settings Integration | 2-3 days | Phase 2, 6 |
| 8 | Calculations Engine | 2-3 days | Phase 3 |

**Total Estimated Time: 26-33 days**

---

## Priority Data Fields (MVP)

For initial release, implement these core fields:

### Must Have (Phase 1)
1. Power (current, 3s, avg, max)
2. Heart Rate (current, avg, max, zone)
3. Cadence (current, avg)
4. Speed (current, avg, max)
5. Distance (total)
6. Time (elapsed, moving)
7. Altitude (current)
8. Elevation Gain (total)

### Should Have (Phase 2)
9. Power Zone
10. Power Normalized (NP)
11. W/kg
12. Lap Count
13. Lap Time
14. Speed (last km avg)
15. Pace (min/km)
16. Grade (%)

### Nice to Have (Phase 3)
17. TSS
18. Kilojoules
19. VAM
20. HR % of Max
21. Time of Day
22. Calories

---

## Migration Strategy

### Backward Compatibility
1. Existing settings (show/hide metrics) map to default screen configuration
2. Auto-migrate users to new system on first load
3. Provide "Classic" layout option that matches current UI

### Migration Code

```typescript
// src/data-fields/migrate.ts

export function migrateFromLegacySettings(oldSettings: AppSettings): DataFieldSettings {
  const defaultProfile = createDefaultCyclingProfile();
  
  // Map old visibility settings to slots
  const visibleFields = [];
  if (oldSettings.power) visibleFields.push('power-current');
  if (oldSettings.cadence) visibleFields.push('cadence-current');
  if (oldSettings.heartrate) visibleFields.push('heartrate-current');
  if (oldSettings.speed) visibleFields.push('speed-current');
  if (oldSettings.distance) visibleFields.push('distance-total');
  if (oldSettings.altitude) visibleFields.push('altitude-current');
  
  // Create screen with visible fields
  defaultProfile.screens[0].slots = visibleFields.map((fieldId, i) => ({
    id: `migrated-${i}`,
    fieldId,
    size: 'medium' as DataFieldSize,
    position: i + 1,
  }));
  
  return {
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id,
    unitSystem: 'metric',
    fieldPreferences: {},
  };
}
```

---

## Testing Plan

### Unit Tests
- Data field registry operations
- Calculator functions (NP, TSS, rolling averages)
- Screen configuration validation
- Migration functions

### Integration Tests
- Data field component rendering
- Screen carousel navigation
- Field picker selection
- Settings persistence

### E2E Tests
- Complete customization flow
- Screen swiping on mobile
- Data updates during workout
- Export/import of layouts

---

## Success Metrics

1. **User Engagement**
   - % of users who customize screens
   - Average number of screens per user
   - Most popular data fields

2. **Performance**
   - Data field update latency < 100ms
   - Screen transition smoothness (60fps)
   - Memory usage with 70+ field types

3. **Usability**
   - Time to customize a screen < 2 minutes
   - Error rate in field picker < 5%
   - Mobile swipe success rate > 95%

---

## References

- [Garmin Data Fields](https://www.garmin.com/en-US/garmin-connect-mobile-features/)
- [Wahoo ELEMNT Data Pages](https://support.wahoofitness.com/hc/en-us/articles/204254864)
- [Hammerhead Karoo Data Overlays](https://support.hammerhead.io/hc/en-us/articles/360034697194)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [CSS Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries)
