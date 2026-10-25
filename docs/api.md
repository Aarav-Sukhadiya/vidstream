# VidStream API Reference

Base URL: `/api` (or `/` for production single-origin deployments)

All responses return standard JSON.

### Standard Response Formats
- **Single Resource:** `{ "video": { ... } }` or `{ "user": { ... } }`
- **Paginated Collection:** `{ "items": [...], "nextCursor": "string" | null }`
- **Mutation Acknowledgement:** `{ "counted": true }` or `{ "subscribed": true, "subscriberCount": 42 }`
- **Error Response:**
  ```json
  {
    "error": {
      "code": "STRING_CODE",
      "message": "Human readable explanation",
      "fields": { "field": "Error description" }
    }
  }
  ```

---

## 1. Authentication & Profile

### `POST /api/auth/register`
Register a new user account.
- **Auth:** Public
- **Body:**
  ```json
  {
    "email": "user@vidstream.com",
    "password": "Password123!",
    "handle": "myhandle",
    "displayName": "My Name"
  }
  ```
- **Response (201):**
  ```json
  {
    "user": { "id": "...", "email": "...", "handle": "myhandle", "displayName": "My Name", "avatarUrl": null },
    "accessToken": "jwt.access.token"
  }
  ```
- **Cookies:** Sets HTTP-only `refreshToken` cookie.

### `POST /api/auth/login`
Authenticate existing user.
- **Auth:** Public
- **Body:**
  ```json
  {
    "email": "user@vidstream.com",
    "password": "Password123!"
  }
  ```
- **Response (200):** Same as register.

### `POST /api/auth/refresh`
Rotate refresh token and issue a fresh access token.
- **Auth:** Requires HTTP-only `refreshToken` cookie.
- **Response (200):**
  ```json
  {
    "accessToken": "new.jwt.access.token"
  }
  ```
- **Cookies:** Rotates HTTP-only `refreshToken` cookie.

### `POST /api/auth/logout`
Invalidate active refresh token session.
- **Auth:** Requires HTTP-only `refreshToken` cookie.
- **Response (200):** `{ "message": "Logged out successfully" }`
- **Cookies:** Clears `refreshToken` cookie.

### `GET /api/me`
Get current authenticated user profile.
- **Auth:** Bearer Token
- **Response (200):**
  ```json
  {
    "user": {
      "id": "...",
      "email": "...",
      "handle": "...",
      "displayName": "...",
      "avatarUrl": "...",
      "bio": "...",
      "subscriberCount": 12
    }
  }
  ```

---

## 2. Videos & Uploads

### `POST /api/videos`
Initiate an upload session and receive signed Cloudinary parameters.
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "title": "My Video Title",
    "description": "Optional description",
    "tags": ["react", "frontend"],
    "visibility": "public"
  }
  ```
- **Response (201):**
  ```json
  {
    "video": { "id": "...", "title": "...", "status": "awaiting_upload" },
    "upload": {
      "url": "https://api.cloudinary.com/v1_1/<cloud_name>/video/upload",
      "fields": {
        "api_key": "...",
        "timestamp": 1234567890,
        "signature": "...",
        "public_id": "...",
        "upload_preset": "..."
      }
    }
  }
  ```

### `POST /api/videos/:id/confirm`
Explicit client fallback to confirm direct upload completion and enqueue transcode job.
- **Auth:** Bearer Token (Video owner)
- **Body:** `{ "sourcePublicId": "raw_public_id" }`
- **Response (200):** `{ "video": { "id": "...", "status": "queued" } }`

### `POST /api/webhooks/cloudinary`
Webhook endpoint called by Cloudinary on upload completion.
- **Auth:** Cloudinary Signature Verification

### `GET /api/videos`
Home feed and full-text search with cursor pagination and tag filtering.
- **Auth:** Public
- **Query Params:**
  - `q`: Search query string (weights: title > tags > description)
  - `tag`: Category tag filter (exact match, case-insensitive)
  - `sort`: `relevance` (default when `q` present), `newest` (default for feed), `views`
  - `cursor`: Opaque pagination cursor
  - `limit`: Number of items per page (1–50, default: 20)
- **Response (200):**
  ```json
  {
    "items": [
      {
        "id": "...",
        "title": "...",
        "description": "...",
        "tags": ["..."],
        "thumbnailUrl": "...",
        "durationSec": 450,
        "viewCount": 1280,
        "publishedAt": "2026-10-25T...",
        "channel": { "id": "...", "handle": "...", "displayName": "...", "avatarUrl": "..." }
      }
    ],
    "nextCursor": "base64_encoded_cursor"
  }
  ```

### `GET /api/videos/:id`
Fetch video details, stream URLs, and viewer-specific context.
- **Auth:** Optional Bearer Token
- **Response (200):**
  ```json
  {
    "video": {
      "id": "...",
      "title": "...",
      "description": "...",
      "tags": ["..."],
      "visibility": "public",
      "status": "ready",
      "hlsUrl": "https://.../master.m3u8",
      "thumbnailUrl": "...",
      "durationSec": 600,
      "viewCount": 1280,
      "likeCount": 96,
      "dislikeCount": 2,
      "commentCount": 14,
      "channel": { "id": "...", "handle": "...", "displayName": "...", "subscriberCount": 53 },
      "viewer": { "reaction": 1, "subscribed": true, "positionSec": 132 }
    }
  }
  ```
- **Access Rules:**
  - `public`: Available to all when `status: ready`.
  - `unlisted`: Accessible via direct link only; hidden from feeds and search.
  - `private`: Accessible only to the video owner; returns 404 to all others.

### `PATCH /api/videos/:id`
Update video title, description, tags, or visibility.
- **Auth:** Bearer Token (Video owner)
- **Body:** `{ "title": "New Title", "visibility": "unlisted" }`
- **Response (200):** `{ "video": { ... } }`

### `DELETE /api/videos/:id`
Permanently delete video, Cloudinary media assets, comments, and reactions.
- **Auth:** Bearer Token (Video owner)
- **Response (200):** `{ "message": "Video deleted successfully" }`

### `POST /api/videos/:id/retry`
Retry a failed transcoding job.
- **Auth:** Bearer Token (Video owner)
- **Response (200):** `{ "video": { "id": "...", "status": "queued" } }`

### `GET /api/videos/:id/related`
Get recommended related videos sharing common tags (excluding current video).
- **Auth:** Public
- **Response (200):** `{ "items": [...] }`

---

## 3. Playback & Engagement

### `POST /api/videos/:id/view`
Record a deduplicated view event (enforces 30s playback threshold; 24h per IP/User TTL).
- **Auth:** Optional Bearer Token
- **Response (200):** `{ "counted": true }` (or `{ "counted": false }` if already counted within 24 hours)

### `PUT /api/videos/:id/reaction`
Set or remove like/dislike reaction.
- **Auth:** Bearer Token
- **Body:** `{ "value": 1 }` (`1` = like, `-1` = dislike, `0` = neutral/remove)
- **Response (200):**
  ```json
  {
    "reaction": 1,
    "likeCount": 97,
    "dislikeCount": 2
  }
  ```

### `PUT /api/videos/:id/progress`
Save viewer playback position (called every 10s and on pause).
- **Auth:** Bearer Token
- **Body:** `{ "positionSec": 132, "durationSec": 600 }`
- **Response (204):** No body.

---

## 4. Comments & Timestamp Links

### `GET /api/videos/:id/comments`
List top-level comments (or nested replies) with cursor pagination.
- **Auth:** Public
- **Query Params:**
  - `parentId`: Optional ID of parent comment to list replies for
  - `cursor`: Opaque pagination cursor
  - `limit`: Number of items (default: 20)
- **Response (200):**
  ```json
  {
    "items": [
      {
        "id": "...",
        "body": "Check out 2:15 for the explanation!",
        "createdAt": "2026-10-25T...",
        "replyCount": 2,
        "author": { "id": "...", "handle": "...", "displayName": "...", "avatarUrl": "..." }
      }
    ],
    "nextCursor": null
  }
  ```

### `POST /api/videos/:id/comments`
Post a new comment or reply (max 10 comments per minute per user; 11th returns 429).
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "body": "Great tutorial! Look at 1:45.",
    "parentId": null
  }
  ```
- **Response (201):** Returns created comment object.

### `DELETE /api/comments/:id`
Delete a comment and any associated replies.
- **Auth:** Bearer Token (Comment author or video owner)
- **Response (200):** `{ "message": "Comment deleted successfully" }`

---

## 5. Channel & Library

### `GET /api/channels/:handle`
Get public channel profile, subscriber count, and public videos.
- **Auth:** Optional Bearer Token (populates `isSubscribed` flag)
- **Response (200):**
  ```json
  {
    "channel": { "id": "...", "handle": "maya", "displayName": "Maya Tech", "bio": "...", "avatarUrl": "...", "subscriberCount": 1420 },
    "isSubscribed": false,
    "videos": [...]
  }
  ```

### `PUT /api/channels/:id/subscription`
Subscribe to a channel (idempotent, rejects self-subscribe with 400).
- **Auth:** Bearer Token
- **Response (200):** `{ "subscribed": true, "subscriberCount": 1421 }`

### `DELETE /api/channels/:id/subscription`
Unsubscribe from a channel.
- **Auth:** Bearer Token
- **Response (200):** `{ "subscribed": false, "subscriberCount": 1420 }`

### `GET /api/feed/subscriptions`
Feed of latest videos from channels the user has subscribed to.
- **Auth:** Bearer Token
- **Response (200):** `{ "items": [...], "nextCursor": "..." }`

### `GET /api/me/history`
List watch history with playback position and progress percentage.
- **Auth:** Bearer Token
- **Response (200):**
  ```json
  {
    "items": [
      {
        "video": { "id": "...", "title": "...", "thumbnailUrl": "..." },
        "positionSec": 150,
        "durationSec": 600,
        "progressPercent": 25,
        "updatedAt": "2026-10-25T..."
      }
    ]
  }
  ```

### `DELETE /api/me/history`
Clear user's entire watch history.
- **Auth:** Bearer Token
- **Response (200):** `{ "message": "Watch history cleared successfully" }`

### `GET /api/me/likes`
List videos liked by the user (newest liked first).
- **Auth:** Bearer Token
- **Response (200):** `{ "items": [...] }`

### `GET /api/me/videos`
Creator studio video management list with real-time transcoding status.
- **Auth:** Bearer Token
- **Response (200):** `{ "items": [...] }`

---

## 6. System & Real-Time Events

### `GET /api/health` and `GET /health`
Liveness and readiness probe for deployment hosts.
- **Auth:** Public
- **Response (200):** `{ "status": "ok", "db": "connected", "uptime": 1234 }`

### WebSocket Events (Socket.IO)
- Client connects with user authentication token: `socket.connect({ auth: { token } })`
- **Events Emitted by Server:**
  - `transcode:progress`: `{ "videoId": "...", "stage": "transcoding", "percent": 45 }`
  - `transcode:ready`: `{ "videoId": "...", "hlsUrl": "...", "durationSec": 180 }`
  - `transcode:failed`: `{ "videoId": "...", "error": "Invalid video codec" }`
