# BPT Simulation Tools

Simulation tools for testing the Bike Power Tracker streaming service with various scenarios.

## Prerequisites

- The BPT service must be running (default: `http://localhost:3000`)
- Install dependencies: `pnpm install`

## Available Simulations

### Multi-User Simulation

Simulates multiple users streaming workout data simultaneously.

```bash
# Default: 5 users streaming for 60 seconds
pnpm run multi-user

# Custom configuration
USERS=10 DURATION=120 API_URL=http://localhost:3000 pnpm run multi-user
```

**Environment Variables:**
- `USERS` - Number of simulated users (default: 5)
- `DURATION` - Duration in seconds (default: 60)
- `API_URL` - Service URL (default: `http://localhost:3000`)
- `API_KEY` - API key if authentication is enabled
- `INTERVAL` - Message interval in ms (default: 1000)

### Stream Viewer

Connects to a stream or all streams and displays incoming messages in the terminal.

```bash
# View all streams
pnpm run viewer

# View specific stream
STREAM=workout-user1 pnpm run viewer
```

### Stress Test

Sends rapid bursts of messages to test service performance.

```bash
# Default: 100 messages as fast as possible
pnpm run stress

# Custom configuration
MESSAGES=500 CONCURRENT=10 pnpm run stress
```

**Environment Variables:**
- `MESSAGES` - Total messages to send (default: 100)
- `CONCURRENT` - Concurrent message senders (default: 5)

## Single User Simulation

Run a single simulated user for debugging:

```bash
pnpm start
```

## Example Output

```
[12:30:45] Starting multi-user simulation
[12:30:45] Users: 5, Duration: 60s, Interval: 1000ms
[12:30:45] [user-1] Created stream: workout-sim-user-1-1703505045
[12:30:45] [user-2] Created stream: workout-sim-user-2-1703505045
...
[12:30:46] [user-1] Sent: 245W, 92rpm, 142bpm
[12:30:46] [user-2] Sent: 198W, 88rpm, 135bpm
...
[12:31:45] Simulation complete
[12:31:45] Total messages sent: 300
[12:31:45] Errors: 0
```
