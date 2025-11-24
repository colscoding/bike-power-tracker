# API Test Scripts

Bash scripts for testing the Redis Streams API using curl.

## Prerequisites

- Server must be running: `npm start`
- `curl` installed
- `jq` (optional, for pretty JSON formatting)

## Scripts

### 1. Create Stream
Create a new Redis stream.

```bash
chmod +x scripts/create-stream.sh
./scripts/create-stream.sh <stream-name>

# Example:
./scripts/create-stream.sh my-stream
```

### 2. Send Message
Send a message to a stream.

```bash
chmod +x scripts/send-message.sh
./scripts/send-message.sh <stream-name> <message> [author]

# Examples:
./scripts/send-message.sh my-stream "Hello World"
./scripts/send-message.sh my-stream "Hello from John" "John"
```

### 3. List Streams
List all available streams.

```bash
chmod +x scripts/list-streams.sh
./scripts/list-streams.sh
```

### 4. Get Messages
Get messages from a stream.

```bash
chmod +x scripts/get-messages.sh
./scripts/get-messages.sh <stream-name> [count]

# Examples:
./scripts/get-messages.sh my-stream
./scripts/get-messages.sh my-stream 50
```

### 5. Listen to Stream
Listen to real-time messages from a stream (Server-Sent Events).

```bash
chmod +x scripts/listen-stream.sh
./scripts/listen-stream.sh <stream-name>

# Example:
./scripts/listen-stream.sh my-stream

# Press Ctrl+C to stop listening
```

### 6. Demo Script
Run a complete demonstration of all features.

```bash
chmod +x scripts/demo.sh
./scripts/demo.sh
```

## Make All Scripts Executable

```bash
chmod +x scripts/*.sh
```

## Quick Test

1. Start the server:
```bash
npm start
```

2. In another terminal, run the demo:
```bash
./scripts/demo.sh
```

3. Listen to a stream in one terminal:
```bash
./scripts/listen-stream.sh demo-stream
```

4. Send messages from another terminal:
```bash
./scripts/send-message.sh demo-stream "Test message 1"
./scripts/send-message.sh demo-stream "Test message 2" "Alice"
```

## Notes

- All scripts default to `http://localhost:3000`
- Scripts use `jq` for JSON formatting if available
- The listen script uses `-N` flag to disable buffering for SSE
