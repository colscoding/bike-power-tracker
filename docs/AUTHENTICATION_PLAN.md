# Authentication Implementation Plan

This document outlines the strategy for adding user authentication to the Bike Power Tracker project.

## 1. Objectives

*   **Secure API**: Prevent unauthorized users from creating streams or writing data.
*   **User Identity**: Associate workouts and streams with specific users.
*   **Personal History**: Allow users to view their past workouts.
*   **Privacy**: Ensure users can only manage their own streams.

## 2. Authentication Options

### Option A: Simple Shared Secret (API Key)
*   **Description**: A single password/key defined in environment variables.
*   **Pros**: Extremely simple to implement. Zero database overhead.
*   **Cons**: No distinction between users. If the key is compromised, it must be changed for everyone.
*   **Verdict**: Good for a private, single-user deployment, but insufficient for a multi-user app.

### Option B: Custom Email/Password (JWT)
*   **Description**: Users register with email/password. Server hashes passwords (bcrypt) and issues JSON Web Tokens (JWT).
*   **Pros**: No reliance on external providers. Full control over user data.
*   **Cons**: High security responsibility (password hashing, reset flows, brute force protection).
*   **Verdict**: High effort for a simple tracker app.

### Option C: OAuth 2.0 (Recommended)
*   **Description**: Users log in via Google, GitHub, or Strava.
*   **Pros**: Secure, familiar to users, no password management, easy access to profile info (avatar, name).
*   **Cons**: Requires registering the app with providers.
*   **Verdict**: Best balance of security and user experience. **Strava** is particularly relevant for a cycling app.

## 3. Recommended Architecture: OAuth + JWT

We will use **Passport.js** with the **Strava** (or Google) strategy. Upon successful login, the server will issue a **JWT** to the client.

### Data Flow
1.  Client clicks "Login with Strava".
2.  Redirects to backend `/auth/strava`.
3.  Backend handles OAuth handshake.
4.  On callback, backend creates/updates user in Redis (`user:{id}`).
5.  Backend issues a JWT and redirects client back with the token (or sets a cookie).
6.  Client includes `Authorization: Bearer <token>` in all API requests.

## 4. Implementation Steps

### Phase 1: Backend (Service)

1.  **Dependencies**:
    ```bash
    npm install passport passport-strava jsonwebtoken
    ```
2.  **User Model (Redis)**:
    *   Store user profiles as hashes: `user:{provider_id}`.
    *   Fields: `displayName`, `avatar`, `createdAt`.
3.  **Auth Routes**:
    *   `GET /auth/login` -> Starts OAuth.
    *   `GET /auth/callback` -> Handles return, generates JWT.
    *   `GET /auth/me` -> Validates token, returns user profile.
4.  **Middleware**:
    *   Create `authenticateToken` middleware to verify JWT.
    *   Attach `req.user` to the request object.
5.  **Protect Endpoints**:
    *   Apply middleware to `POST /api/streams/create`, `POST .../messages`, `DELETE ...`.
    *   `GET` endpoints can remain public or be protected depending on privacy requirements.

### Phase 2: Frontend (Client)

1.  **UI Components**:
    *   Add a "Login" button to the header.
    *   Show user avatar/name when logged in.
2.  **Auth State Management**:
    *   Store JWT in `localStorage` or `sessionStorage`.
    *   Handle token expiration (logout).
3.  **API Client Update**:
    *   Modify `streamClient.js` to inject the `Authorization` header if a token exists.

### Phase 3: Stream Ownership

1.  **Link Streams to Users**:
    *   When creating a stream, store the `userId` in a separate key (e.g., `stream:{name}:meta`).
2.  **Enforce Permissions**:
    *   In `DELETE` endpoints, check if `req.user.id` matches the stream owner.
3.  **User History**:
    *   Create a Redis Set `user:{id}:streams` to track all streams created by a user.
    *   Add endpoint `GET /api/my-streams`.

## 5. Configuration

New environment variables required:

```env
# Auth
JWT_SECRET=your_super_secret_key
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
# or
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```
