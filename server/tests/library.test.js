const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const WatchProgress = require('../src/models/WatchProgress');
const Reaction = require('../src/models/Reaction');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Watch History and Liked Videos Suite (Checkpoint 20)', () => {
  let testUser;
  let authToken;
  let video1;
  let video2;
  let video3;

  beforeAll(async () => {
    await connectDB();
    await WatchProgress.deleteMany({});
    await Reaction.deleteMany({});
    await Video.deleteMany({});
    await User.deleteMany({ email: 'library_user@test.com' });

    testUser = await User.create({
      email: 'library_user@test.com',
      passwordHash: 'dummyhash',
      handle: 'library_user',
      displayName: 'Library User',
    });
    authToken = generateAccessToken(testUser);

    video1 = await Video.create({
      owner: testUser._id,
      title: 'History Video 1',
      durationSec: 600,
      status: 'ready',
      visibility: 'public',
    });

    video2 = await Video.create({
      owner: testUser._id,
      title: 'History Video 2',
      durationSec: 300,
      status: 'ready',
      visibility: 'public',
    });

    video3 = await Video.create({
      owner: testUser._id,
      title: 'Disliked Video 3',
      durationSec: 400,
      status: 'ready',
      visibility: 'public',
    });

    // Create watch progress records with different updated times
    const now = Date.now();
    await WatchProgress.create({
      user: testUser._id,
      video: video1._id,
      positionSec: 150,
      durationSec: 600,
      updatedAt: new Date(now - 10000),
    });

    await WatchProgress.create({
      user: testUser._id,
      video: video2._id,
      positionSec: 270,
      durationSec: 300,
      updatedAt: new Date(now), // newer
    });

    // Create reactions: video1 liked, video2 liked later, video3 disliked
    await Reaction.create({
      user: testUser._id,
      video: video1._id,
      value: 1,
      createdAt: new Date(now - 20000),
      updatedAt: new Date(now - 20000),
    });

    await Reaction.create({
      user: testUser._id,
      video: video2._id,
      value: 1,
      createdAt: new Date(now - 5000),
      updatedAt: new Date(now - 5000), // newer like
    });

    await Reaction.create({
      user: testUser._id,
      video: video3._id,
      value: -1, // dislike
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
  });

  afterAll(async () => {
    await WatchProgress.deleteMany({});
    await Reaction.deleteMany({});
    await Video.deleteMany({});
    await User.deleteMany({ email: 'library_user@test.com' });
    await disconnectDB();
  });

  describe('1. Watch History', () => {
    it('returns watch history sorted by updatedAt descending with progress', async () => {
      const res = await request(app)
        .get('/api/me/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBe(2);

      // video2 was updated more recently than video1
      expect(res.body.items[0].video.id).toBe(video2._id.toString());
      expect(res.body.items[0].positionSec).toBe(270);
      expect(res.body.items[0].progressPercent).toBe(90); // 270 / 300 * 100

      expect(res.body.items[1].video.id).toBe(video1._id.toString());
      expect(res.body.items[1].positionSec).toBe(150);
      expect(res.body.items[1].progressPercent).toBe(25); // 150 / 600 * 100
    });

    it('rejects unauthenticated history requests with 401', async () => {
      await request(app).get('/api/me/history').expect(401);
    });

    it('clears watch history completely on DELETE /api/me/history', async () => {
      const deleteRes = await request(app)
        .delete('/api/me/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/me/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getRes.body.items).toEqual([]);
    });
  });

  describe('2. Liked Videos', () => {
    it('returns liked videos newest first and excludes dislikes', async () => {
      const res = await request(app)
        .get('/api/me/likes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBe(2);

      // video2 was liked more recently than video1
      expect(res.body.items[0].id).toBe(video2._id.toString());
      expect(res.body.items[1].id).toBe(video1._id.toString());

      // video3 was disliked so it must NOT be in the liked list
      const ids = res.body.items.map((item) => item.id);
      expect(ids).not.toContain(video3._id.toString());
    });

    it('rejects unauthenticated likes requests with 401', async () => {
      await request(app).get('/api/me/likes').expect(401);
    });
  });
});
