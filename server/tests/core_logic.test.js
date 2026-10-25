const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const RefreshToken = require('../src/models/RefreshToken');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Core Logic Suite: Visibility, Auth Rotation, and Search (Checkpoint 23)', () => {
  let creatorUser, viewerUser;
  let creatorToken, viewerToken;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['creator_core@test.com', 'viewer_core@test.com'] } });
    await Video.deleteMany({ title: /CoreLogic/ });

    creatorUser = await User.create({
      email: 'creator_core@test.com',
      passwordHash: 'dummyhash',
      handle: 'creator_core',
      displayName: 'Creator Core',
    });

    viewerUser = await User.create({
      email: 'viewer_core@test.com',
      passwordHash: 'dummyhash',
      handle: 'viewer_core',
      displayName: 'Viewer Core',
    });

    creatorToken = generateAccessToken(creatorUser);
    viewerToken = generateAccessToken(viewerUser);
  });

  afterAll(async () => {
    await Video.deleteMany({ title: /CoreLogic/ });
    await RefreshToken.deleteMany({ user: { $in: [creatorUser?._id, viewerUser?._id] } });
    await User.deleteMany({ email: { $in: ['creator_core@test.com', 'viewer_core@test.com'] } });
    await disconnectDB();
  });

  describe('1. Visibility Rules (Public, Unlisted, Private)', () => {
    let publicVideo, unlistedVideo, privateVideo;

    beforeAll(async () => {
      publicVideo = await Video.create({
        owner: creatorUser._id,
        title: 'CoreLogic Public Video',
        description: 'Discoverable everywhere',
        tags: ['coretest', 'visibility'],
        visibility: 'public',
        status: 'ready',
        publishedAt: new Date(),
      });

      unlistedVideo = await Video.create({
        owner: creatorUser._id,
        title: 'CoreLogic Unlisted Video',
        description: 'Only accessible via direct link',
        tags: ['coretest', 'visibility'],
        visibility: 'unlisted',
        status: 'ready',
        publishedAt: new Date(),
      });

      privateVideo = await Video.create({
        owner: creatorUser._id,
        title: 'CoreLogic Private Video',
        description: 'Only accessible by owner',
        tags: ['coretest', 'visibility'],
        visibility: 'private',
        status: 'ready',
        publishedAt: new Date(),
      });
    });

    it('unlisted video is accessible via direct GET /api/videos/:id to both guests and other users', async () => {
      // Guest
      const guestRes = await request(app).get(`/api/videos/${unlistedVideo._id}`).expect(200);
      expect(guestRes.body.video.title).toBe('CoreLogic Unlisted Video');

      // Viewer
      const viewerRes = await request(app)
        .get(`/api/videos/${unlistedVideo._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
      expect(viewerRes.body.video.title).toBe('CoreLogic Unlisted Video');
    });

    it('unlisted video is strictly excluded from home feed and text search', async () => {
      // Home feed
      const feedRes = await request(app).get('/api/videos').expect(200);
      const feedIds = feedRes.body.items.map((v) => v.id);
      expect(feedIds).not.toContain(unlistedVideo._id.toString());

      // Search
      const searchRes = await request(app)
        .get('/api/videos?q=CoreLogic+Unlisted')
        .expect(200);
      const searchIds = searchRes.body.items.map((v) => v.id);
      expect(searchIds).not.toContain(unlistedVideo._id.toString());
    });

    it('unlisted video is strictly excluded from channel profile video listings', async () => {
      const channelRes = await request(app)
        .get(`/api/channels/${creatorUser.handle}`)
        .expect(200);
      const videoIds = channelRes.body.videos.map((v) => v.id);
      expect(videoIds).not.toContain(unlistedVideo._id.toString());
    });

    it('unlisted and private videos are excluded from related recommendations', async () => {
      const relatedRes = await request(app)
        .get(`/api/videos/${publicVideo._id}/related`)
        .expect(200);
      const relatedIds = relatedRes.body.items.map((v) => v.id);
      expect(relatedIds).not.toContain(unlistedVideo._id.toString());
      expect(relatedIds).not.toContain(privateVideo._id.toString());
    });

    it('private video returns 404 for guests and other users, but 200 for the owner', async () => {
      // Guest -> 404
      const guestRes = await request(app).get(`/api/videos/${privateVideo._id}`).expect(404);
      expect(guestRes.body.error.code).toBe('NOT_FOUND');

      // Other user -> 404
      const viewerRes = await request(app)
        .get(`/api/videos/${privateVideo._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(404);
      expect(viewerRes.body.error.code).toBe('NOT_FOUND');

      // Owner -> 200
      const ownerRes = await request(app)
        .get(`/api/videos/${privateVideo._id}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
      expect(ownerRes.body.video.title).toBe('CoreLogic Private Video');
    });
  });

  describe('2. Auth Token Rotation & Reuse Invalidation', () => {
    let authUserEmail = 'rotation_test_user@test.com';
    let authUserPassword = 'Password123!';
    let initialRefreshTokenCookie;

    beforeAll(async () => {
      await User.deleteMany({ email: authUserEmail });
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: authUserEmail,
          password: authUserPassword,
          handle: 'rotation_tester',
          displayName: 'Rotation Tester',
        })
        .expect(201);

      const cookies = regRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      initialRefreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(initialRefreshTokenCookie).toBeDefined();
    });

    afterAll(async () => {
      await User.deleteMany({ email: authUserEmail });
    });

    it('refreshing rotates token: issues valid access token and a new refresh token cookie', async () => {
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [initialRefreshTokenCookie])
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(typeof refreshRes.body.accessToken).toBe('string');

      const newCookies = refreshRes.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newRefreshCookie = newCookies.find((c) => c.startsWith('refreshToken='));
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).not.toBe(initialRefreshTokenCookie);

      // Verify the new access token can access /api/me
      const meRes = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
        .expect(200);
      expect(meRes.body.user.email).toBe(authUserEmail);
    });

    it('refresh token reuse detection: replaying the consumed refresh token revokes entire family with 401', async () => {
      // Attempting to reuse initialRefreshTokenCookie which was already rotated
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [initialRefreshTokenCookie])
        .expect(401);

      expect(reuseRes.body.error).toBeDefined();
      expect(reuseRes.body.error.code).toBe('UNAUTHENTICATED');
      expect(reuseRes.body.error.message).toMatch(/reuse/i);
    });

    it('rejects protected routes without valid bearer token', async () => {
      const res = await request(app).get('/api/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');

      const invalidRes = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer invalid.token.payload')
        .expect(401);
      expect(invalidRes.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('3. Text Search Ranking & Edge Cases', () => {
    let titleMatchVideo, descMatchVideo;

    beforeAll(async () => {
      const now = Date.now();
      titleMatchVideo = await Video.create({
        owner: creatorUser._id,
        title: 'CoreLogic Quantum Computing In Action',
        description: 'A basic introduction to qubits',
        tags: ['coretest', 'quantum'],
        visibility: 'public',
        status: 'ready',
        publishedAt: new Date(now),
      });

      descMatchVideo = await Video.create({
        owner: creatorUser._id,
        title: 'CoreLogic Classical Computing Principles',
        description: 'Compared to Quantum Computing principles and algorithms',
        tags: ['coretest', 'physics'],
        visibility: 'public',
        status: 'ready',
        publishedAt: new Date(now - 1000),
      });
    });

    it('ranks title match higher than description match', async () => {
      const res = await request(app)
        .get('/api/videos?q=Quantum+Computing&sort=relevance')
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      const items = res.body.items;
      const titleIndex = items.findIndex((i) => i.id === titleMatchVideo._id.toString());
      const descIndex = items.findIndex((i) => i.id === descMatchVideo._id.toString());

      expect(titleIndex).toBeGreaterThanOrEqual(0);
      expect(descIndex).toBeGreaterThanOrEqual(0);
      expect(titleIndex).toBeLessThan(descIndex);
    });

    it('safely handles search query with unescaped regex special characters (q=a(b)', async () => {
      const res = await request(app).get('/api/videos?q=a(b').expect(200);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('filters strictly by tag when tag param is provided', async () => {
      const res = await request(app)
        .get('/api/videos?q=CoreLogic&tag=quantum')
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      res.body.items.forEach((item) => {
        expect(item.tags).toContain('quantum');
      });
    });
  });
});
