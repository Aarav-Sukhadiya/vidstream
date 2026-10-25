const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const ViewEvent = require('../src/models/ViewEvent');
const WatchProgress = require('../src/models/WatchProgress');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Watch Page, Visibility, Views & Resume Playback Suite (Checkpoints 13 & 14)', () => {
  let ownerUser, otherUser;
  let ownerToken, otherToken;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['watch_owner@test.com', 'watch_other@test.com'] } });

    ownerUser = await User.create({
      email: 'watch_owner@test.com',
      passwordHash: 'dummyhash',
      handle: 'watch_owner',
      displayName: 'Watch Owner',
    });

    otherUser = await User.create({
      email: 'watch_other@test.com',
      passwordHash: 'dummyhash',
      handle: 'watch_other',
      displayName: 'Watch Other',
    });

    ownerToken = generateAccessToken(ownerUser);
    otherToken = generateAccessToken(otherUser);
  });

  afterAll(async () => {
    if (ownerUser && otherUser) {
      await Video.deleteMany({ owner: { $in: [ownerUser._id, otherUser._id] } });
      await ViewEvent.deleteMany({});
      await WatchProgress.deleteMany({});
      await User.deleteMany({ _id: { $in: [ownerUser._id, otherUser._id] } });
    }
    await disconnectDB();
  });

  it('GET /api/videos/:id returns 200 for public ready video', async () => {
    const video = await Video.create({
      owner: ownerUser._id,
      title: 'Public Ready Video',
      visibility: 'public',
      status: 'ready',
      hlsUrl: '/media/sample/hls/master.m3u8',
      durationSec: 180,
    });

    const res = await request(app).get(`/api/videos/${video._id}`);
    expect(res.status).toBe(200);
    expect(res.body.video.title).toBe('Public Ready Video');
    expect(res.body.video.hlsUrl).toBe('/media/sample/hls/master.m3u8');
    expect(res.body.video.channel.handle).toBe('watch_owner');
  });

  it('GET /api/videos/:id returns 404 for private video when requested as a guest or other user', async () => {
    const privateVideo = await Video.create({
      owner: ownerUser._id,
      title: 'Private Video',
      visibility: 'private',
      status: 'ready',
    });

    // Guest request
    const guestRes = await request(app).get(`/api/videos/${privateVideo._id}`);
    expect(guestRes.status).toBe(404);
    expect(guestRes.body.error.code).toBe('NOT_FOUND');

    // Other authenticated user request
    const otherRes = await request(app)
      .get(`/api/videos/${privateVideo._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(404);

    // Owner request returns 200
    const ownerRes = await request(app)
      .get(`/api/videos/${privateVideo._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.video.title).toBe('Private Video');
  });

  it('GET /api/videos/:id returns 404 for non-ready video unless owner', async () => {
    const processingVideo = await Video.create({
      owner: ownerUser._id,
      title: 'Processing Video',
      visibility: 'public',
      status: 'processing',
    });

    const guestRes = await request(app).get(`/api/videos/${processingVideo._id}`);
    expect(guestRes.status).toBe(404);

    const ownerRes = await request(app)
      .get(`/api/videos/${processingVideo._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
  });

  it('POST /api/videos/:id/view counts first view and deduplicates repeat views', async () => {
    const video = await Video.create({
      owner: ownerUser._id,
      title: 'View Counting Video',
      status: 'ready',
      viewCount: 0,
    });

    // First view count
    const res1 = await request(app)
      .post(`/api/videos/${video._id}/view`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.counted).toBe(true);

    const check1 = await Video.findById(video._id);
    expect(check1.viewCount).toBe(1);

    // Second view count by same user (within 24h)
    const res2 = await request(app)
      .post(`/api/videos/${video._id}/view`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.counted).toBe(false);

    const check2 = await Video.findById(video._id);
    expect(check2.viewCount).toBe(1); // Still 1! Deduplicated.
  });

  it('PUT /api/videos/:id/progress saves position and GET /api/videos/:id returns progress', async () => {
    const video = await Video.create({
      owner: ownerUser._id,
      title: 'Resume Playback Video',
      status: 'ready',
      durationSec: 300,
    });

    const saveRes = await request(app)
      .put(`/api/videos/${video._id}/progress`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ positionSec: 85, durationSec: 300 });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.positionSec).toBe(85);

    const fetchRes = await request(app)
      .get(`/api/videos/${video._id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.video.viewer).toBeDefined();
    expect(fetchRes.body.video.viewer.progressSec).toBe(85);
  });
});
