# BPT Simulation Tools

Comprehensive simulation and testing tools for the Bike Power Tracker streaming service.

## Overview

The simulation package provides tools for:

- **Single User Simulation** - Simulate a cyclist performing a workout
- **Multi-User Simulation** - Simulate multiple concurrent users
- **Stream Viewer** - Real-time visualization of streaming data
- **Stress Testing** - Performance and reliability testing

## Features

### Realistic Workout Simulation

- **Workout Profiles**: Endurance, Intervals, Sprint, Recovery, Random
- **Physiological Modeling**: 
  - Heart rate lag (~15 seconds behind effort changes)
  - Fatigue accumulation over time
  - Realistic cadence patterns based on intensity
- **Athlete Profiles**: 
  - Random FTP (180-280W), max HR (175-195 bpm)
  - Weight, preferred cadence, resting HR

### Professional Output

- Formatted terminal output with colors
- Progress bars and statistics tables
- Latency histograms for stress tests
- Workout summary with min/max/avg metrics

## Quick Start

```bash
# Make sure the service is running
cd ../service && docker-compose up -d

# Run a single user simulation
pnpm start

# Run multiple users
pnpm multi

# Watch streams in real-time
pnpm viewer

# Run stress test
pnpm stress
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm start` | Single user simulation |
| `pnpm multi` | Multi-user simulation |
| `pnpm viewer` | Stream viewer |
| `pnpm stress` | Stress test |
| `pnpm demo` | Quick 60s interval demo |
| `pnpm demo:multi` | Quick 60s multi-user demo |
| `pnpm list` | List active streams |
| `pnpm cleanup` | Delete all simulation streams |
| `pnpm help` | Show command-line options |

## Configuration

All scripts accept command-line arguments:

### Common Options

```bash
--api-url=URL       # Service URL (default: http://localhost:3000)
--api-key=KEY       # API key for authentication
--duration=SECONDS  # Simulation duration (default: 60)
--interval=MS       # Message interval (default: 1000)
--profile=NAME      # Workout profile (see below)
--cleanup           # Delete streams after completion
--verbose           # Show detailed output
--help              # Show help
```

### Single User Options

```bash
pnpm start --profile=intervals --duration=120
pnpm start --cleanup --verbose
```

### Multi-User Options

```bash
pnpm multi --users=10 --duration=300
pnpm multi --users=5 --profile=endurance
```

### Stress Test Options

```bash
pnpm stress --messages=5000 --concurrent=10
```

### Viewer Options

```bash
pnpm viewer                      # Watch all streams
pnpm viewer --stream=NAME        # Watch specific stream
pnpm viewer --list               # List streams
pnpm viewer --delete=NAME        # Delete a stream
pnpm viewer --cleanup            # Delete simulation streams
```

## Workout Profiles

| Profile | Description |
|---------|-------------|
| `endurance` | Steady-state zone 2 ride with warm-up and cool-down |
| `intervals` | High-intensity interval training (HIIT) |
| `sprint` | Short all-out efforts with recovery |
| `recovery` | Easy spin for active recovery |
| `random` | Random profile (default for multi-user) |

### Profile Details

**Endurance**
- 10% warm-up at 50% FTP
- 80% main effort at 70% FTP
- 10% cool-down at 40% FTP

**Intervals**
- 10% warm-up at 55% FTP
- 5× (12% work at 105% FTP + 8% recovery at 50% FTP)
- 10% cool-down at 45% FTP

**Sprint**
- 15% warm-up at 60% FTP
- 6× (5% sprint at 150% FTP + 8% recovery at 45% FTP)
- 15% cool-down at 40% FTP

**Recovery**
- 100% easy spinning at 40-45% FTP

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BPT_API_URL` | Service URL | `http://localhost:3000` |
| `BPT_API_KEY` | API key | (none) |

## Architecture

```
src/
├── config.js           # Configuration and utilities
├── api.js              # API client with retry logic
├── workout-generator.js # Realistic workout data generation
├── index.js            # Single user simulation
├── multi-user.js       # Multi-user simulation
├── stream-viewer.js    # Real-time stream viewer
└── stress-test.js      # Performance testing
```

### Key Components

**WorkoutGenerator Class**
```javascript
import { WorkoutGenerator, createAthleteProfile } from './workout-generator.js';

const athlete = createAthleteProfile();  // Random athlete
const generator = new WorkoutGenerator(athlete, 'intervals');

// Advance simulation by one tick (1 second)
generator.tick();

// Get current workout data
const data = generator.getData();
// { power: 245, cadence: 92, heartrate: 158 }

// Get session statistics
const stats = generator.getStats();
// { duration: 120, power: { avg: 210, max: 280, min: 95 }, ... }
```

**API Client**
```javascript
import { createStream, sendMessage, listStreams } from './api.js';

await createStream('my-workout');
await sendMessage('my-workout', { power: 200, cadence: 90 });
const { streams } = await listStreams();
```

## Example Output

### Single User Simulation

```
╔══════════════════════════════════════════════════╗
║          BPT Single User Simulation              ║
╚══════════════════════════════════════════════════╝

[SIM] Profile:    intervals
[SIM] Duration:   120s
[SIM] Interval:   1000ms
[SIM] API URL:    http://localhost:3000

[SIM] Service is healthy ✓
[SIM] Stream created: workout-sim-single-1234567890
[SIM] Athlete FTP: 235W, Max HR: 182bpm

──────────────────────────────────────────────────
  Time   |  Power  | Cadence | Heart Rate
──────────────────────────────────────────────────
  00:01  |  125W   | 85rpm   |  98bpm
  00:02  |  128W   | 86rpm   | 102bpm
  ...
```

### Multi-User Summary

```
══════════════════════════════════════════════════════════════════════════════
  Multi-User Simulation Summary
══════════════════════════════════════════════════════════════════════════════

  User        │ Profile    │ FTP   │ Avg W │ Max W │ Avg HR │ Msgs  │ Errs
────────────────────────────────────────────────────────────────────────────────
  cyclist-1   │ intervals  │   235 │   198 │   285 │    152 │    60 │    0
  cyclist-2   │ endurance  │   210 │   155 │   178 │    138 │    60 │    0
  cyclist-3   │ sprint     │   248 │   205 │   372 │    161 │    60 │    0
────────────────────────────────────────────────────────────────────────────────
  Total: 180 messages, 0 errors
  Rate:  3.0 msg/sec total
         1.0 msg/sec per user
══════════════════════════════════════════════════════════════════════════════
```

### Stress Test Results

```
═══════════════════════════════════════════════════════
  Stress Test Results
═══════════════════════════════════════════════════════

  Summary:
  ────────────────────────────────────────────────────
    Duration:        12.34s
    Messages sent:   1,000
    Errors:          0 (0.0%)
    Throughput:      81.0 msg/sec

  Latency Distribution:
  ────────────────────────────────────────────────────
    Min:             8ms
    Average:         12ms
    Median (p50):    11ms
    p90:             18ms
    p95:             24ms
    p99:             45ms
    Max:             89ms

  Latency Histogram:
  ────────────────────────────────────────────────────
    ≤  10ms: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   423 (42%)
    ≤  25ms: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       356 (36%)
    ≤  50ms: ▓▓▓▓▓▓▓▓               189 (19%)
    ≤ 100ms: ▓▓                      32 (3%)

═══════════════════════════════════════════════════════
```

## Troubleshooting

### Service Not Available

```bash
# Make sure the service is running
cd ../service
docker-compose up -d

# Check health
curl http://localhost:3000/health
```

### Connection Refused

The simulation tools automatically retry connections. If persistent:

1. Check the API URL is correct
2. Verify the service is running and healthy
3. Check for firewall or network issues

### High Error Rate in Stress Tests

- Reduce concurrent senders: `--concurrent=3`
- Increase interval: `--interval=500`
- Check service resources (CPU, memory, Redis)

## Development

The simulation uses ES modules and requires Node.js 18+.

```bash
# Install dependencies
pnpm install

# Run with verbose output for debugging
pnpm start --verbose

# Test different profiles
pnpm start --profile=sprint --duration=30
```
