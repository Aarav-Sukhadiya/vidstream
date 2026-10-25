const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Authentication & User Model Suite (Checkpoint 3)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /@vidstreamtest\.com$/ } });
    await RefreshToken.deleteMany({});
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: { $regex: /@vidstreamtest\.com$/ } });
    await RefreshToken.deleteMany({});
  });

  const testUser = {
    email: 'maya@vidstreamtest.com',
    password: 'Password123!',
    handle: 'maya_creator',
    displayName: 'Maya Creator',
    bio: 'CS student and creator',
  };

  it('Register returns 201, user payload without passwordHash, and sets refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.handle).toBe(testUser.handle);
    expect(res.body.user.displayName).toBe(testUser.displayName);
    expect(res.body.user.passwordHash).toBeUndefined();

    // Verify refresh token cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

    // Verify stored password in database is a bcrypt hash (starts with $2a$ or $2b$) and not plaintext
    const dbUser = await User.findOne({ email: testUser.email });
    expect(dbUser).toBeDefined();
    expect(dbUser.passwordHash).not.toBe(testUser.password);
    expect(dbUser.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);

    // Verify comparePassword method
    const isMatch = await dbUser.comparePassword(testUser.password);
    expect(isMatch).toBe(true);
    const isBadMatch = await dbUser.comparePassword('WrongPassword');
    expect(isBadMatch).toBe(false);
  });

  it('Registering the same email again returns 409 CONFLICT', async () => {
    // First registration
    const firstRes = await request(app).post('/api/auth/register').send(testUser);
    expect(firstRes.status).toBe(201);

    // Second registration with same email but different handle
    const duplicateEmailRes = await request(app).post('/api/auth/register').send({
      ...testUser,
      handle: 'another_handle',
    });

    expect(duplicateEmailRes.status).toBe(409);
    expect(duplicateEmailRes.body).toHaveProperty('error');
    expect(duplicateEmailRes.body.error.code).toBe('CONFLICT');
    expect(duplicateEmailRes.body.error.fields).toHaveProperty('email');
  });

  it('Registering the same handle again returns 409 CONFLICT', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const duplicateHandleRes = await request(app).post('/api/auth/register').send({
      ...testUser,
      email: 'different@vidstreamtest.com',
    });

    expect(duplicateHandleRes.status).toBe(409);
    expect(duplicateHandleRes.body.error.code).toBe('CONFLICT');
    expect(duplicateHandleRes.body.error.fields).toHaveProperty('handle');
  });

  it('Register rejects passwords shorter than 8 characters with 400 VALIDATION', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...testUser,
      password: 'short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('password');
  });

  it('Login with valid credentials returns 200, user, accessToken, and cookie', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('user');
    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body.user.email).toBe(testUser.email);
    expect(loginRes.headers['set-cookie']).toBeDefined();
  });

  it('Login with incorrect password returns 401 UNAUTHENTICATED', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Login with non-existent email returns 401 UNAUTHENTICATED', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@vidstreamtest.com',
      password: 'AnyPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
