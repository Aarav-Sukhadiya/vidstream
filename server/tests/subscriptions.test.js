const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Subscription = require('../src/models/Subscription');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Subscriptions & Subscriptions Feed Suite (Checkpoint 19)', () => {
  let viewerUser;
  let viewerToken;
  let creatorUser1;
  let creatorUser2;
  let creator1Video1;

  beforeAll(async () => {
    await connectDB();
    await Subscription.deleteMany({});
    await Video.deleteMany({});
    await User.deleteMany({
      email: { $in: ['viewer_sub@test.com', 'creator1_sub@test.com', 'creator2_sub@test.com'] },
    });

    viewerUser = await User.create({
      email: 'viewer_sub@test.com',
      passwordHash: 'dummyhash',
      handle: 'viewer_sub',
      displayName: 'Viewer Sub',
    });
    viewerToken = generateAccessToken(viewerUser);

    creatorUser1 = await User.create({
      email: 'creator1_sub@test.com',
      passwordHash: 'dummyhash',
      handle: 'creator1_sub',
      displayName: 'Creator One',
      subscriberCount: 0,
    });

    creatorUser2 = await User.create({
      email: 'creator2_sub@test.com',
      passwordHash: 'dummyhash',
      handle: 'creator2_sub',
      displayName: 'Creator Two',
      subscriberCount: 0,
    });

    const now = Date.now();

    creator1Video1 = await Video.create({
      owner: creatorUser1._id,
      title: 'Creator 1 - Video 1',
      status: 'ready',
      visibility: 'public',
      publishedAt: new Date(now - 10000),
    });

    await Video.create({
      owner: creatorUser1._id,
      title: 'Creator 1 - Video 2',
      status: 'ready',
      visibility: 'public',
      publishedAt: new Date(now - 5000),
    });

    await Video.create({
      owner: creatorUser2._id,
      title: 'Creator 2 - Video 1',
      status: 'ready',
      visibility: 'public',
      publishedAt: new Date(now - 2000),
    });
  });

  afterAll(async () => {
    await Subscription.deleteMany({});
    await Video.deleteMany({});
    await User.deleteMany({
      email: { $in: ['viewer_sub@test.com', 'creator1_sub@test.com', 'creator2_sub@test.com'] },
    });
    await disconnectDB();
  });

  describe('1. Subscribe Endpoint', () => {
    it('rejects self-subscribe with 400 VALIDATION', async () => {
      const res = await request(app)
        .put(`/api/channels/${viewerUser._id}/subscription`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain('Cannot subscribe to your own channel');
    });

    it('subscribes successfully and increments subscriberCount', async () => {
      const res = await request(app)
        .put(`/api/channels/${creatorUser1._id}/subscription`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body).toEqual({
        subscribed: true,
        subscriberCount: 1,
      });

      const updatedCreator = await User.findById(creatorUser1._id);
      expect(updatedCreator.subscriberCount).toBe(1);
    });

    it('subscribing twice is idempotent and leaves exactly one row in DB', async () => {
      const res = await request(app)
        .put(`/api/channels/${creatorUser1._id}/subscription`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.subscribed).toBe(true);
      expect(res.body.subscriberCount).toBe(1);

      // Verify row count in database
      const rowCount = await Subscription.countDocuments({
        subscriber: viewerUser._id,
        channel: creatorUser1._id,
      });
      expect(rowCount).toBe(1);

      const creator = await User.findById(creatorUser1._id);
      expect(creator.subscriberCount).toBe(1);
    });
  });

  describe('2. Subscriptions Feed Endpoint', () => {
    it('shows only videos from subscribed channels in descending order', async () => {
      const res = await request(app)
        .get('/api/feed/subscriptions')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBe(2);

      const returnedTitles = res.body.items.map((v) => v.title);
      expect(returnedTitles).toContain('Creator 1 - Video 1');
      expect(returnedTitles).toContain('Creator 1 - Video 2');
      // creatorUser2 is NOT subscribed to, so creator2Video must NOT be in the feed
      expect(returnedTitles).not.toContain('Creator 2 - Video 1');
    });

    it('returns empty list if viewer is not subscribed to any channels', async () => {
      const freshUser = await User.create({
        email: 'fresh_sub@test.com',
        passwordHash: 'dummyhash',
        handle: 'fresh_sub',
        displayName: 'Fresh Sub',
      });
      const freshToken = generateAccessToken(freshUser);

      const res = await request(app)
        .get('/api/feed/subscriptions')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      expect(res.body.items).toEqual([]);

      await User.deleteOne({ _id: freshUser._id });
    });
  });

  describe('3. Channel Profile & Video Viewer Integration', () => {
    it('returns channel profile with videos and isSubscribed flag', async () => {
      const res = await request(app)
        .get(`/api/channels/${creatorUser1.handle}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.channel.handle).toBe(creatorUser1.handle);
      expect(res.body.channel.isSubscribed).toBe(true);
      expect(res.body.channel.subscriberCount).toBe(1);
      expect(res.body.videos.length).toBe(2);
    });

    it('video endpoint returns viewer.subscribed = true when subscribed', async () => {
      const res = await request(app)
        .get(`/api/videos/${creator1Video1._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.video.viewer).toBeDefined();
      expect(res.body.video.viewer.subscribed).toBe(true);
    });
  });

  describe('4. Unsubscribe Endpoint', () => {
    it('unsubscribes and decrements subscriberCount', async () => {
      const res = await request(app)
        .delete(`/api/channels/${creatorUser1._id}/subscription`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body).toEqual({
        subscribed: false,
        subscriberCount: 0,
      });

      const count = await Subscription.countDocuments({
        subscriber: viewerUser._id,
        channel: creatorUser1._id,
      });
      expect(count).toBe(0);

      const creator = await User.findById(creatorUser1._id);
      expect(creator.subscriberCount).toBe(0);
    });
  });
});
