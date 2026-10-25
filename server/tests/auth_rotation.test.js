const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Auth Rotation, Reuse Detection & /me Middleware Suite (Checkpoint 4)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /@rotationtest\.com$/ } });
    await RefreshToken.deleteMany({});
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: { $regex: /@rotationtest\.com$/ } });
    await RefreshToken.deleteMany({});
  });

  const testUser = {
    email: 'alex@rotationtest.com',
    password: 'Password123!',
    handle: 'alex_creator',
    displayName: 'Alex Creator',
  };

  it('/me requires an access token and rejects unauthenticated requests', async () => {
    const resNoToken = await request(app).get('/api/me');
    expect(resNoToken.status).toBe(401);
    expect(resNoToken.body.error.code).toBe('UNAUTHENTICATED');

    const resInvalidToken = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid.token.value');
    expect(resInvalidToken.status).toBe(401);
    expect(resInvalidToken.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('/me returns user profile when valid Bearer access token is supplied', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    expect(regRes.status).toBe(201);
    const { accessToken } = regRes.body;

    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toHaveProperty('user');
    expect(meRes.body.user.email).toBe(testUser.email);
    expect(meRes.body.user.handle).toBe(testUser.handle);
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  it('POST /auth/refresh rotates the refresh token and issues a new access token', async () => {
    // 1. Register and capture cookie
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const initialCookie = regRes.headers['set-cookie'];
    expect(initialCookie).toBeDefined();

    // 2. Call /api/auth/refresh with the cookie
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', initialCookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body).toHaveProperty('user');

    // Verify a new rotated cookie was set and is distinct from the first
    const rotatedCookie = refreshRes.headers['set-cookie'];
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie[0]).not.toBe(initialCookie[0]);

    // 3. New access token works with /me
    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
  });

  it('Old refresh token is rejected once rotated (used refresh token rejected)', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const originalCookie = regRes.headers['set-cookie'];

    // First rotation succeeds
    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);

    // Attempting to reuse the original (now rotated) cookie must be rejected
    const reuseAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);

    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Reusing a rotated refresh token triggers reuse detection and revokes the session', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const originalCookie = regRes.headers['set-cookie'];

    // Rotate once to get legitimate session 2
    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);
    const secondCookie = firstRefresh.headers['set-cookie'];

    // Malicious actor or replay attempts to reuse the already-rotated originalCookie
    const reuseAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);
    expect(reuseAttempt.status).toBe(401);

    // Due to reuse detection, even the active secondCookie must now be invalidated
    const activeSessionAfterBreach = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie);
    expect(activeSessionAfterBreach.status).toBe(401);
    expect(activeSessionAfterBreach.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Logout revokes the refresh token and clears the cookie', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const cookie = regRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toMatch(/logged out/i);

    // Refresh after logout should fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});
