# Stream Viewer Interactive Features Plan

## Overview

This document outlines the implementation plan for adding interactive features to the Stream Viewer page, enabling viewers to send messages and emojis to streamers during live workouts.

## Current State

The client currently has:
- **Real-time streaming**: Streamers can broadcast workout data via Redis Streams
- **Stream viewing**: Basic viewer functionality exists (watching live metrics)
- **SSE connection**: Server-Sent Events for real-time data consumption
- **API client**: `streamClient.ts` handles stream communication

**Missing**: Bidirectional communication (viewer → streamer interaction)

## Goals

1. Allow viewers to send text messages to streamers
2. Enable quick emoji reactions (💪, 🔥, 👍, ⚡, 🚴, etc.)
3. Display messages in real-time for both streamer and viewers
4. Provide moderation capabilities (future consideration)
5. Maintain performance during high-frequency interactions

## Architecture Design

### 1. Data Flow

```
┌──────────────┐      POST /api/interactions      ┌──────────────┐
│   Viewer     │─────────────────────────────────▶│   Service    │
│   Client     │                                   │   (Express)  │
└──────────────┘                                   └──────┬───────┘
       ▲                                                  │
       │                                                  ▼
       │                                           ┌──────────────┐
       │            SSE /api/interactions/listen   │    Redis     │
       └───────────────────────────────────────────│   Pub/Sub    │
                                                   └──────────────┘
```

### 2. Redis Channel Structure

**Option A: Dedicated Interaction Streams** (Recommended)
- Separate Redis Stream per workout for interactions
- Stream name: `interactions:{workoutId}` or `interactions:{streamName}`
- Messages persist for replay/history
- Supports moderation and analytics

**Option B: Redis Pub/Sub**
- Real-time only, no persistence
- Channel: `interactions:{streamName}`
- Simpler, lower latency
- No message history

**Decision**: Start with **Option A** (Redis Streams) for consistency with existing architecture and to enable future features (moderation, message history, analytics).

## Implementation Plan

### Phase 1: Backend Infrastructure (Service Package)

#### 1.1 Database Schema (Prisma)

Create new models for interaction storage:

```prisma
// prisma/schema.prisma

model Interaction {
  id              String    @id @default(cuid())
  workoutId       String    // Foreign key to workout
  streamName      String    @index
  userId          String?   // Optional: for authenticated users
  viewerName      String?   // Display name (anonymous or username)
  type            InteractionType
  content         String    // Message text or emoji
  timestamp       DateTime  @default(now())
  
  workout         Workout   @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  
  @@index([workoutId, timestamp])
  @@index([streamName, timestamp])
}

enum InteractionType {
  MESSAGE
  EMOJI
  CHEER       // Future: gift/support
}
```

#### 1.2 API Endpoints

**File**: `packages/service/src/routes/interactions.ts`

```typescript
// POST /api/interactions/:streamName
// Send a message or emoji to a stream
{
  type: 'message' | 'emoji',
  content: string,
  viewerName?: string,
  userId?: string  // Future: authentication
}

// GET /api/interactions/:streamName/listen
// SSE endpoint for real-time interaction updates
// Streams all new interactions as they arrive

// GET /api/interactions/:streamName/history
// Retrieve recent interactions (last 50-100)
{
  limit?: number,
  before?: timestamp
}

// DELETE /api/interactions/:interactionId (Future)
// Moderation: Remove offensive content
```

#### 1.3 Validation Rules

**File**: `packages/service/src/validation.ts`

```typescript
export const interactionSchema = z.object({
  type: z.enum(['message', 'emoji']),
  content: z.string()
    .min(1)
    .max(500), // Max 500 chars for messages
  viewerName: z.string()
    .min(1)
    .max(50)
    .optional(),
  userId: z.string().optional(),
});

// Emoji validation: only allow specific emoji codes
export const ALLOWED_EMOJIS = [
  '💪', '🔥', '👍', '⚡', '🚴', '🎉', '👏', '❤️', 
  '💯', '🏆', '🚀', '💨', '🌟', '😅'
];
```

#### 1.4 Rate Limiting

Prevent spam:
- **Messages**: Max 5 per minute per viewer (IP-based)
- **Emojis**: Max 10 per minute per viewer
- Use `express-rate-limit` middleware

#### 1.5 Redis Interaction Stream Manager

**File**: `packages/service/src/services/InteractionStreamManager.ts`

```typescript
export class InteractionStreamManager {
  // Add interaction to stream
  async addInteraction(streamName: string, interaction: Interaction): Promise<string>
  
  // Listen to interactions via Redis XREAD
  async readInteractions(streamName: string, lastId: string): Promise<Interaction[]>
  
  // Get interaction history
  async getHistory(streamName: string, limit: number): Promise<Interaction[]>
  
  // Clean up old interactions (TTL)
  async cleanupStream(streamName: string): Promise<void>
}
```

### Phase 2: Client Implementation

#### 2.1 API Client Extension

**File**: `packages/client/src/api/interactionClient.ts`

```typescript
export interface Interaction {
  id: string;
  type: 'message' | 'emoji';
  content: string;
  viewerName: string;
  timestamp: Date;
}

export interface SendInteractionOptions {
  streamName: string;
  type: 'message' | 'emoji';
  content: string;
  viewerName?: string;
}

// Send message or emoji
export async function sendInteraction(options: SendInteractionOptions): Promise<void>

// Get interaction history
export async function getInteractionHistory(streamName: string, limit?: number): Promise<Interaction[]>

// Listen to interactions via SSE
export function listenToInteractions(
  streamName: string,
  onInteraction: (interaction: Interaction) => void,
  onError?: (error: Error) => void
): () => void // Returns cleanup function
```

#### 2.2 State Management

**File**: `packages/client/src/state/InteractionState.ts`

```typescript
export class InteractionState {
  private interactions: Interaction[] = [];
  private listeners: Set<(interactions: Interaction[]) => void> = new Set();
  private sseCleanup?: () => void;
  
  // Add new interaction
  addInteraction(interaction: Interaction): void
  
  // Get all interactions
  getInteractions(): Interaction[]
  
  // Clear all
  clear(): void
  
  // Subscribe to changes
  subscribe(listener: (interactions: Interaction[]) => void): () => void
  
  // Start listening via SSE
  startListening(streamName: string): void
  
  // Stop listening and cleanup
  stopListening(): void
}
```

#### 2.3 UI Components

##### 2.3.1 InteractionPanel Component

**File**: `packages/client/src/components/InteractionPanel.ts`

A Web Component for displaying and sending interactions:

```typescript
export class InteractionPanel extends HTMLElement {
  private state: InteractionState;
  private streamName: string;
  
  connectedCallback(): void {
    this.render();
    this.attachEventListeners();
    this.state.startListening(this.streamName);
  }
  
  disconnectedCallback(): void {
    this.state.stopListening();
  }
  
  private render(): void {
    this.innerHTML = `
      <div class="interaction-panel">
        <div class="interaction-messages" role="log" aria-live="polite">
          <!-- Messages display here -->
        </div>
        
        <div class="emoji-bar">
          <!-- Quick emoji buttons -->
          <button class="emoji-btn" data-emoji="💪" aria-label="Strong">💪</button>
          <button class="emoji-btn" data-emoji="🔥" aria-label="Fire">🔥</button>
          <!-- ... more emojis -->
        </div>
        
        <form class="message-form">
          <input 
            type="text" 
            class="message-input" 
            placeholder="Send a message..."
            maxlength="500"
            aria-label="Message input"
          />
          <button type="submit" class="send-btn" aria-label="Send message">
            Send
          </button>
        </form>
      </div>
    `;
  }
  
  private attachEventListeners(): void {
    // Emoji click handlers
    // Message form submit
    // Auto-scroll to latest message
  }
  
  private onInteractionReceived(interaction: Interaction): void {
    // Add to DOM
    // Play subtle animation
    // Update aria-live region for screen readers
  }
}
```

##### 2.3.2 Message Display Structure

```html
<div class="interaction-item" data-type="message">
  <span class="viewer-name">John</span>
  <span class="interaction-content">Great pace! Keep it up!</span>
  <span class="interaction-time">2s ago</span>
</div>

<div class="interaction-item" data-type="emoji">
  <span class="viewer-name">Sarah</span>
  <span class="interaction-emoji">💪</span>
  <span class="interaction-time">5s ago</span>
</div>
```

#### 2.4 Viewer Name Management

**File**: `packages/client/src/storage/viewerStorage.ts`

Store viewer name in localStorage:

```typescript
const VIEWER_NAME_KEY = 'bpt_viewer_name';

export function getViewerName(): string | null {
  return localStorage.getItem(VIEWER_NAME_KEY);
}

export function setViewerName(name: string): void {
  localStorage.setItem(VIEWER_NAME_KEY, name);
}

export function generateAnonymousName(): string {
  // Generate fun names like "CyclingPanda42", "TurboSloth88"
  const adjectives = ['Fast', 'Strong', 'Turbo', 'Epic', 'Mighty'];
  const animals = ['Panda', 'Tiger', 'Eagle', 'Lion', 'Wolf'];
  const num = Math.floor(Math.random() * 100);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}${num}`;
}
```

#### 2.5 View Integration

##### Update StreamerView (Dashboard)

**File**: `packages/client/src/views/DashboardView.ts`

Add interaction panel when streaming is active:

```typescript
export class DashboardView implements View {
  private interactionState?: InteractionState;
  
  public onStreamingStarted(streamName: string): void {
    // Show interaction panel for streamer
    this.interactionState = new InteractionState();
    this.showInteractionPanel(streamName, 'streamer');
  }
  
  private showInteractionPanel(streamName: string, mode: 'streamer' | 'viewer'): void {
    const panel = document.createElement('interaction-panel');
    panel.setAttribute('stream-name', streamName);
    panel.setAttribute('mode', mode);
    // ... mount to DOM
  }
}
```

##### Create ViewerView

**File**: `packages/client/src/views/ViewerView.ts`

New view for watching streams:

```typescript
export class ViewerView implements View {
  public id = 'viewer';
  private streamName?: string;
  private interactionState: InteractionState;
  
  public init(container: HTMLElement): void {
    this.renderViewerUI(container);
  }
  
  public onEnter(params?: { streamName: string }): void {
    if (params?.streamName) {
      this.streamName = params.streamName;
      this.startViewing();
    }
  }
  
  private startViewing(): void {
    // 1. Connect to stream SSE
    // 2. Initialize interaction panel
    // 3. Display metrics
    // 4. Show interaction history
  }
  
  private renderViewerUI(container: HTMLElement): void {
    container.innerHTML = `
      <div class="viewer-layout">
        <div class="metrics-display">
          <!-- Power, HR, Cadence, Speed -->
        </div>
        <interaction-panel></interaction-panel>
      </div>
    `;
  }
}
```

#### 2.6 Styling

**File**: `packages/client/src/styles/interaction-panel.css`

```css
.interaction-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 400px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
}

.interaction-messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.interaction-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-primary);
  border-radius: 4px;
  animation: slideIn 0.3s ease-out;
}

.interaction-item[data-type="emoji"] {
  font-size: 1.5rem;
}

.emoji-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.emoji-btn {
  font-size: 1.5rem;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.emoji-btn:hover {
  transform: scale(1.2);
  background: var(--accent-color);
}

.emoji-btn:active {
  animation: pop 0.3s ease-out;
}

.message-form {
  display: flex;
  gap: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.send-btn {
  padding: 0.75rem 1.5rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn:hover {
  background: var(--accent-color-dark);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
```

### Phase 3: Features & Enhancements

#### 3.1 Viewer Name Prompt

When a user first visits viewer mode, show a modal:

```html
<dialog class="viewer-name-dialog" open>
  <h2>Join the Stream</h2>
  <p>Choose a display name to interact with the streamer:</p>
  <form>
    <input 
      type="text" 
      placeholder="Your name" 
      maxlength="50"
      required
    />
    <button type="submit">Join</button>
  </form>
  <button class="anonymous-btn">Join Anonymously</button>
</dialog>
```

#### 3.2 Notification System

When streamer receives interaction:
- Show toast notification (non-intrusive)
- Play subtle sound effect (optional, user-configurable)
- Badge count on interaction panel button

#### 3.3 Animation & Effects

- **Emoji rain**: When multiple same emojis sent rapidly, animate them falling
- **Combo counter**: Show "x3 🔥" when same emoji sent multiple times
- **Fade out old messages**: After 2 minutes, fade messages to keep UI clean

#### 3.4 Accessibility

- ARIA live regions for screen readers
- Keyboard navigation (Tab, Enter)
- Focus management for message input
- Alt text for emoji meanings
- Reduced motion support (prefers-reduced-motion)

#### 3.5 Performance Optimizations

- **Virtualized scrolling**: Only render visible messages (use Intersection Observer)
- **Message limit**: Max 100 messages in memory, older ones removed
- **Debounced rendering**: Batch multiple incoming interactions
- **Lazy load history**: Only load when panel is opened

### Phase 4: Future Enhancements

#### 4.1 Advanced Features (Phase 2)

- **Reaction counts**: Aggregate same emojis (e.g., "💪 x15")
- **User authentication**: Link interactions to user accounts
- **Moderation tools**: Block/mute users, filter profanity
- **Rich emojis**: Animated GIFs, custom stickers
- **Sound effects**: Optional audio feedback for emojis
- **Cheers/Tips**: Virtual gifts or support badges

#### 4.2 Analytics & Insights

- Track engagement metrics (messages/min, popular emojis)
- Show interaction heatmap during workout review
- Viewer count display

#### 4.3 Social Features

- Reply to specific messages (threading)
- @ mentions
- Streamer-only announcements
- Pin important messages

## Testing Strategy

### Unit Tests

**Files**:
- `InteractionState.test.ts`: State management logic
- `interactionClient.test.ts`: API client functions
- `viewerStorage.test.ts`: LocalStorage operations

### Integration Tests

**Files**:
- `test-integration/viewer-interaction.spec.js`: Full interaction flow
  - Send message from viewer
  - Receive on streamer side
  - Emoji reactions
  - Message history

### E2E Tests (Playwright)

**Scenarios**:
1. Open viewer page, set name, send message
2. Multiple viewers sending emojis simultaneously
3. Reconnection after network failure
4. Rate limiting behavior

## Security Considerations

1. **Input Sanitization**: Escape all user content (XSS prevention)
2. **Rate Limiting**: Prevent spam/DoS
3. **Content Filtering**: Basic profanity filter (optional)
4. **CORS**: Restrict API access to known origins
5. **Message Size**: Enforce max length server-side
6. **Authentication**: Future: Require login for messaging

## Performance Targets

- Message latency: < 500ms (sender → all viewers)
- UI responsiveness: 60fps during emoji animations
- Memory usage: < 50MB for 100 active interactions
- Concurrent viewers: Support 100+ per stream

## Deployment Checklist

### Backend
- [ ] Run Prisma migration: `npx prisma migrate dev --name add_interactions`
- [ ] Add new environment variables (if needed)
- [ ] Deploy updated service
- [ ] Test API endpoints

### Frontend
- [ ] Update client with new views and components
- [ ] Test on mobile devices (Android/iOS)
- [ ] Verify accessibility with screen reader
- [ ] Load test with multiple viewers

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1     | Backend API + Redis | 3-4 days |
| 2     | Client API + State | 2-3 days |
| 2     | UI Components | 3-4 days |
| 2     | View Integration | 2 days |
| 3     | Polish & Features | 2-3 days |
| 4     | Testing | 2 days |
| **Total** | | **14-18 days** |

## Success Metrics

- [ ] Viewers can send messages to streamers
- [ ] < 1 second message delivery latency
- [ ] Zero message loss during active connections
- [ ] Works on mobile (iOS Safari, Android Chrome)
- [ ] Accessible via keyboard and screen reader
- [ ] No performance degradation with 50+ messages

## Open Questions

1. Should interactions be public (all viewers see) or private (only streamer)?
   - **Recommendation**: Public for community engagement
2. Store interactions in PostgreSQL or only Redis?
   - **Recommendation**: Both (Redis for real-time, Postgres for history)
3. Allow anonymous viewers or require names?
   - **Recommendation**: Allow anonymous with generated names
4. Maximum interaction history to display?
   - **Recommendation**: Last 50 messages, paginate for more

## References

- [Redis Streams Documentation](https://redis.io/docs/data-types/streams/)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Web Components (MDN)](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- Existing: [streamClient.ts](../src/api/streamClient.ts)
- Existing: [MeasurementsState.ts](../src/measurements-state.ts)
