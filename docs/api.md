# VidStream API Reference

Base URL: `/api`

All JSON responses follow standard formats.
- Successful resource response: `{ "video": { ... } }` or `{ "items": [...], "nextCursor": "..." }`
- Error response: `{ "error": { "code": "STRING", "message": "STRING", "fields": { ... } } }`

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | No | Register new account |
| POST | `/auth/login` | No | Authenticate user & set httpOnly refresh token cookie |
| POST | `/auth/refresh` | Cookie | Rotate refresh token and issue new access token |
| POST | `/auth/logout` | Cookie | Invalidate refresh token and clear cookie |
| GET | `/me` | Yes | Get authenticated user profile |
| POST | `/videos` | Yes | Initiate upload session & obtain signed Cloudinary parameters |
| POST | `/webhooks/cloudinary` | Verified | Cloudinary upload webhook to confirm upload & queue transcode |
| GET | `/videos` | No | Feed and search: `q`, `tag`, `sort` (`relevance` \| `newest` \| `views`), `cursor` |
| GET | `/videos/:id` | Optional | Video details, stream URL, status (viewer context if logged in) |
| PATCH | `/videos/:id` | Owner | Edit video title, description, tags, visibility |
| DELETE | `/videos/:id` | Owner | Delete video, Cloudinary assets, comments & reactions |
| POST | `/videos/:id/retry` | Owner | Re-queue a failed transcode job |
| GET | `/videos/:id/related` | No | Related videos sharing tags |
| GET | `/me/videos` | Yes | Creator studio video list with live transcode status |
| POST | `/videos/:id/view` | Optional | Record deduplicated view (30s playback threshold) |
| PUT | `/videos/:id/reaction` | Yes | Set reaction (1 = like, -1 = dislike, 0 = remove) |
| PUT | `/videos/:id/progress` | Yes | Save playback position every 10s |
| GET | `/videos/:id/comments` | No | List comments (cursor-paginated) |
| POST | `/videos/:id/comments` | Yes | Add comment or 1-level deep reply |
| DELETE | `/comments/:id` | Author | Delete comment |
| GET | `/channels/:handle` | No | Channel public profile and videos |
| PUT | `/channels/:id/subscription` | Yes | Subscribe to channel |
| DELETE | `/channels/:id/subscription` | Yes | Unsubscribe from channel |
| GET | `/feed/subscriptions` | Yes | Feed of videos from subscribed channels |
| GET | `/me/history` | Yes | Watch history with progress timestamps |
| DELETE | `/me/history` | Yes | Clear watch history |
| GET | `/me/likes` | Yes | Liked videos feed |
| GET | `/health` | No | Health check & host liveness probe |
