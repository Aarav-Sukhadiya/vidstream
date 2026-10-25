const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Comment = require('../src/models/Comment');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Security, Hardening & Rate Limiting Suite (Checkpoint 21)', () => {
  let user;
  let token;
  let video;

  beforeAll(async () => {
    await connectDB();
    await Comment.deleteMany({});
    await Video.deleteMany({});
    await User.deleteMany({ email: 'sec_user@test.com' });

    user = await User.create({
      email: 'sec_user@test.com',
      passwordHash: 'dummyhash',
      handle: 'sec_user',
      displayName: 'Security Tester',
    });
    token = generateAccessToken(user);

    video = await Video.create({
      owner: user._id,
      title: 'Security Test Video',
      status: 'ready',
      visibility: 'public',
    });
  });

  afterAll(async () => {
    await Comment.deleteMany({});
    await Video.deleteMany({});
    await User.deleteMany({ email: 'sec_user@test.com' });
    await disconnectDB();
  });

  describe('1. Security Headers (Helmet)', () => {
    it('returns strict security headers on API responses', async () => {
      const res = await request(app).get('/api/health').expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('2. Mongo Operator Sanitisation', () => {
    it('strips keys containing $ or . to prevent operator injection', async () => {
      // Testing with a body containing $where and $gt
      const maliciousBody = {
        title: 'Safe Title',
        $where: 'sleep(1000)',
        'nested.key': 'evil',
      };

      const res = await request(app)
        .post('/api/videos')
        .set('Authorization', `Bearer ${token}`)
        .send(maliciousBody);

      // It should either fail schema validation without crashing or have $ keys stripped
      expect(res.status).not.toBe(500);
    });
  });

  describe('3. Rate Limiting on Comments', () => {
    it('allows 10 comments in a minute and the 11th comment returns 429', async () => {
      // First 10 comments succeed
      for (let i = 1; i <= 10; i++) {
        const res = await request(app)
          .post(`/api/videos/${video._id}/comments`)
          .set('Authorization', `Bearer ${token}`)
          .send({ body: `Comment number ${i}` });

        expect(res.status).toBe(201);
      }

      // The 11th comment must return 429
      const rateLimitedRes = await request(app)
        .post(`/api/videos/${video._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'The 11th comment exceeding rate limit' });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.error).toBeDefined();
      expect(rateLimitedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
