# 🔍 BPT Service Inspector

A web-based API testing and inspection tool for the Bike Power Tracker Service. This tool provides a Postman-like interface for exploring and testing the BPT Service REST API.

## Features

### 📊 Dashboard
- **Real-time Health Monitoring**: Check service, Redis, and database status
- **Connection Testing**: Verify connectivity to local and production environments
- **Quick Overview**: Visual health cards with status indicators

### 🌊 Active Streams
- **Stream Management**: View all active Redis streams
- **Message Statistics**: See message counts and last message IDs
- **Live Updates**: Refresh to see current stream state

### 💾 Database Inspector
- **Workout History**: Browse recent workouts from the database
- **Session Details**: View duration, distance, and timestamps
- **Pagination Support**: Navigate through stored workouts

### 👤 User Lookup
- **Profile Inspector**: Look up user profiles by UUID
- **Statistics Viewer**: See aggregated workout stats for users
- **Dual-pane Display**: Profile and stats shown side-by-side

### ⚡ API Tester
A comprehensive API testing interface similar to Postman:

#### Core Features
- **HTTP Methods**: Support for GET, POST, PUT, PATCH, DELETE
- **Custom Paths**: Build any API endpoint path
- **JSON Body**: Format and send request payloads
- **Response Inspector**: View formatted JSON responses
- **Status Indicators**: Color-coded success/error badges
- **Timing Info**: Request duration tracking

#### Available Endpoints

##### Health & Status
```
GET /health
Returns service health status including Redis and database connectivity
```

##### Streams API
```
GET /api/streams
List all active Redis streams with metadata

POST /api/streams/create
Body: { "streamName": "my-stream" }
Create a new Redis stream

POST /api/streams/{streamName}/messages
Body: { "message": "Hello", "author": "Alice" }
Add a message to a stream

GET /api/streams/{streamName}/messages?start=-&end=+&count=100
Get messages from a stream with optional filtering

GET /api/streams/{streamName}/listen
Establish SSE connection for real-time messages (specific stream)

GET /api/streams/listenAll
Establish SSE connection for real-time messages (all streams)

DELETE /api/streams/{streamName}
Delete a specific stream

DELETE /api/streams/cleanup?retention=86400000
Cleanup inactive streams older than retention period
```

##### Workouts API
```
POST /api/workouts
Body: { "streamName": "workout-123", "title": "Morning Ride", "sport": "cycling", "userId": "<uuid>" }
Create a new workout record

GET /api/workouts?userId={uuid}&page=1&limit=20&status=ACTIVE
List workouts with pagination and filtering

GET /api/workouts/{workoutId}?includeTelemetry=false
Get a single workout by ID

PATCH /api/workouts/{workoutId}
Body: { "title": "Evening Ride", "description": "Easy spin", "sport": "cycling" }
Update workout metadata

DELETE /api/workouts/{workoutId}
Delete a workout and its associated stream

POST /api/workouts/{workoutId}/complete
Body: { "archiveTelemetry": true }
Complete an active workout and calculate statistics

GET /api/workouts/by-stream/{streamName}
Get the active workout associated with a stream
```

##### Users API
```
GET /api/users/{userId}
Get public user profile

GET /api/users/{userId}/stats
Get aggregated workout statistics for a user
```

## Configuration

### Service Target
Switch between environments:
- **Local**: `http://localhost:3000`
- **Production**: `http://78.109.17.187`

Custom URLs can be configured in the source code.

### API Key
Optional authentication via `X-API-Key` header. Configure in the sidebar settings. The API key is stored in localStorage for convenience.

## Usage

### Running Locally
```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build
```

### Testing Endpoints

#### Example 1: Create a Stream
1. Select "API Tester" from sidebar
2. Method: `POST`
3. Path: `/streams/create`
4. Body:
```json
{
  "streamName": "test-stream-123"
}
```
5. Click "Send Request 🚀"

#### Example 2: Add Message to Stream
1. Method: `POST`
2. Path: `/streams/test-stream-123/messages`
3. Body:
```json
{
  "message": "Power: 250W, HR: 150bpm",
  "author": "sensor-client"
}
```

#### Example 3: Create Workout
1. Method: `POST`
2. Path: `/workouts`
3. Body:
```json
{
  "streamName": "workout-stream-abc",
  "title": "Morning Training",
  "sport": "cycling"
}
```

#### Example 4: Get Workout Statistics
1. Method: `GET`
2. Path: `/users/{userId}/stats`
3. Leave body empty (GET request)

## Technical Details

### Technology Stack
- **Framework**: Vanilla TypeScript with Vite
- **Styling**: TailwindCSS
- **Build Tool**: Vite
- **Type Safety**: Full TypeScript support

### API Documentation
The inspector is synchronized with the OpenAPI specification at `packages/service/openapi.yaml`. All endpoint descriptions, schemas, and examples are derived from this specification.

### Response Handling
- **Success (2xx)**: Green status badge, formatted JSON
- **Error (4xx/5xx)**: Red status badge, error details displayed
- **Network Error**: Red badge with error message
- **Timing**: Response time displayed in milliseconds

### Data Storage
- **Service URL**: Persisted to localStorage
- **API Key**: Persisted to localStorage (client-side only)
- **Session Data**: Not persisted (cleared on refresh)

## Development

### Project Structure
```
packages/inspect/
├── index.html          # Entry point
├── package.json        # Dependencies
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript config
├── tailwind.config.js  # TailwindCSS config
├── postcss.config.js   # PostCSS config
└── src/
    ├── main.ts         # Application logic
    └── style.css       # Global styles
```

### Adding New Endpoints
To add a new endpoint to the API Tester:

1. Check `packages/service/openapi.yaml` for the endpoint spec
2. Add example in this README under "Available Endpoints"
3. Consider adding a dedicated UI tab if the endpoint deserves special treatment (like the User Lookup feature)

### Extending the Inspector
The inspector uses a simple tab-based architecture:
- **Dashboard Tab**: Health checks
- **Streams Tab**: Redis stream inspection
- **Database Tab**: Workout history
- **Users Tab**: User profile lookup
- **Actions Tab**: Generic API tester

To add a new tab:
1. Add tab type to `Tab` union type
2. Add tab button in `renderSidebar()`
3. Implement render function (e.g., `renderMyNewTab()`)
4. Add case in `render()` function

## API Reference

This tool is designed to test the complete BPT Service API. For full API documentation, see:
- OpenAPI Spec: `packages/service/openapi.yaml`
- Service README: `packages/service/README.md`

### Key Concepts

#### Redis Streams
Messages are stored in Redis Streams with unique IDs in the format `timestamp-sequence` (e.g., `1700001234567-0`).

#### Server-Sent Events (SSE)
Real-time endpoints return text/event-stream content type. These cannot be tested directly in the API Tester but can be accessed via:
```javascript
const es = new EventSource('http://localhost:3000/api/streams/my-stream/listen');
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

#### Workout Lifecycle
1. **ACTIVE**: Workout in progress, stream is live
2. **PAUSED**: Workout paused, no new data
3. **COMPLETED**: Workout finished, stats calculated
4. **ARCHIVED**: Telemetry moved to database
5. **DELETED**: Soft delete, can be recovered

## Troubleshooting

### CORS Errors
If testing against a remote server, ensure CORS is configured correctly in the service. Local development should work out of the box.

### 401 Unauthorized
Check if the service requires API key authentication. Add your key in the sidebar settings.

### 503 Service Unavailable
- **Redis**: Check if Redis is running
- **Database**: Check if PostgreSQL is configured and running

### Connection Refused
Verify the service URL is correct and the service is running:
```bash
# Local service
curl http://localhost:3000/health

# Production service
curl http://78.109.17.187/health
```

## Future Enhancements
- [ ] Request history with replay
- [ ] Environment variable management
- [ ] Request collections/favorites
- [ ] WebSocket testing support
- [ ] SSE visualization
- [ ] Response diff/comparison
- [ ] Export request as cURL/fetch
- [ ] Authentication flow testing (OAuth)
- [ ] GraphQL support (if added to service)

## Contributing
This tool is part of the Bike Power Tracker monorepo. Follow the project's contribution guidelines.

## License
MIT - Same as the main Bike Power Tracker project
