# Structured Workouts Implementation Plan

**Objective:** Enable users to follow interval-based workouts with specific power or heart rate targets.

## 1. Architecture

We will implement a `WorkoutManager` class that acts as the "Coach". It will:
-   Load a workout definition.
-   Track the current active interval.
-   Manage the countdown timer for the current interval.
-   Calculate dynamic targets based on user settings (FTP/MaxHR).
-   Emit events for UI updates (e.g., "interval changed", "5 seconds remaining").

### Data Flow
`WorkoutManager` -> (reads) -> `UserSettings` (for FTP calculations)
`WorkoutManager` -> (emits) -> `WorkoutState` (Current Interval, Target, Time Remaining)
`UI` -> (subscribes) -> `WorkoutManager`

## 2. Data Models (`src/workouts/types.ts`)

### Workout Structure
```typescript
export type TargetType = 'power' | 'heartrate' | 'cadence' | 'rpe' | 'open';

export interface WorkoutTarget {
    type: TargetType;
    min?: number; // Absolute value or %
    max?: number;
    value?: number; // Target value
    unit: 'watts' | 'percent_ftp' | 'bpm' | 'percent_max_hr' | 'rpm';
}

export type IntervalType = 'warmup' | 'active' | 'recovery' | 'cooldown';

export interface WorkoutStep {
    order: number;
    type: IntervalType;
    duration: number; // Seconds
    name?: string;
    description?: string;
    target?: WorkoutTarget;
    // For ramps
    rampStart?: WorkoutTarget;
    rampEnd?: WorkoutTarget;
}

export interface Workout {
    id: string;
    name: string;
    description: string;
    author?: string;
    steps: WorkoutStep[];
    totalDuration: number;
    category?: string; // e.g., "FTP Builder", "Recovery"
}
```

## 3. Core Logic (`src/workouts/WorkoutManager.ts`)

**Responsibilities:**
-   `loadWorkout(workout: Workout)`: Prepares the workout.
-   `start()`: Starts the timer.
-   `pause()` / `resume()`
-   `stop()`
-   `nextInterval()`: Force skip to next.
-   `tick()`: Called every second (or high freq) to update state.
-   `events`: 'intervalStart', 'intervalComplete', 'workoutComplete'.

**State:**
```typescript
interface ActiveWorkoutState {
    workout: Workout;
    currentStepIndex: number;
    stepTimeRemaining: number;
    elapsedTime: number;
    isPaused: boolean;
    currentTarget?: {
        min: number;
        max: number;
        value: number;
        unit: string;
    }
}
```

## 4. Workouts Library (`src/workouts/library.ts`)

Hardcoded initial workouts:
1.  **FTP Test (Ramp)**: Progressive difficulty.
2.  **2x20 FTP Intervals**: Classic threshold workout.
3.  **Tabata**: High intensity, short rest.
4.  **Z2 Endurance**: Steady state.

## 5. UI Components

### a. Workout Selection Modal
-   List view of available workouts.
-   Details view (Graph of intervals, Description).
-   "Start Workout" button.

### b. Workout Overlay (Dashboard)
-   **Visuals**:
    -   Target Gauge (Current Power vs Target).
    -   Type: "Interval Data Field"
-   **Fields**:
    -   Target Power
    -   Interval Time Remaining
    -   Next Interval Description

### c. Workout Bar (Bottom/Top)
-   Visual representation of the full workout (blocks).
-   Progress indicator.

## 6. Implementation Stages

1.  **Core Engine** (Types, Manager, Library) - **Current Phase**
2.  **Integration** (Hooking into `main.ts`, Settings for FTP)
3.  **UI - Selection** (Modal)
4.  **UI - Execution** (Overlay/Fields)
5.  **Parsers** (ZWO import)

## 7. Extensions
-   **Sound**: Beep before interval change.
-   **TTS**: Read out instructions ("Next up: 5 minutes at 200 Watts").
