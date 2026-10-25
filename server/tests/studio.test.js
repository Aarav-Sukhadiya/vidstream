const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Job = require('../src/models/Job');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');
const { TEMP_BASE } = require('../src/workers');

describe('Creator Studio & Video Management Suite (Checkpoint 12)', () => {
  let userA, userB;
  let tokenA, tokenB;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['studio_a@test.com', 'studio_b@test.com'] } });

    userA = await User.create({
      email: 'studio_a@test.com',
      passwordHash: 'dummyhash',
      handle: 'creator_a',
      displayName: 'Creator A',
    });

    userB = await User.create({
      email: 'studio_b@test.com',
      passwordHash: 'dummyhash',
      handle: 'creator_b',
      displayName: 'Creator B',
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);
  });

  afterAll(async () => {
    if (userA && userB) {
      await Video.deleteMany({ owner: { $in: [userA._id, userB._id] } });
      await Job.deleteMany({});
      await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    }
    await disconnectDB();
  });

  it('GET /api/me/videos returns only authenticated user videos with status and metadata', async () => {
    await Video.create({
      owner: userA._id,
      title: 'Video by User A',
      status: 'ready',
      durationSec: 120,
    });

    await Video.create({
      owner: userB._id,
      title: 'Video by User B',
      status: 'ready',
      durationSec: 60,
    });

    const res = await request(app)
      .get('/api/me/videos')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((v) => v.title === 'Video by User A')).toBe(true);
    expect(res.body.items.some((v) => v.title === 'Video by User B')).toBe(false);
  });

  it('POST /api/videos/:id/retry resets a failed video back to queued', async () => {
    const failedVideo = await Video.create({
      owner: userA._id,
      title: 'Failed Clip',
      status: 'failed',
      failureReason: 'Transcode process exited with error',
    });

    await Job.create({
      video: failedVideo._id,
      status: 'failed',
      attempts: 3,
      lastError: 'Transcode process exited with error',
    });

    const res = await request(app)
      .post(`/api/videos/${failedVideo._id}/retry`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.video.status).toBe('queued');

    const updatedVideo = await Video.findById(failedVideo._id);
    expect(updatedVideo.status).toBe('queued');
    expect(updatedVideo.failureReason).toBeNull();

    const resetJob = await Job.findOne({ video: failedVideo._id });
    expect(resetJob.status).toBe('queued');
    expect(resetJob.attempts).toBe(0);
  });

  it('POST /api/videos/:id/retry rejects non-failed videos with 400', async () => {
    const readyVideo = await Video.create({
      owner: userA._id,
      title: 'Already Ready Clip',
      status: 'ready',
    });

    const res = await request(app)
      .post(`/api/videos/${readyVideo._id}/retry`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('PATCH /api/videos/:id edits metadata and preserves ownership', async () => {
    const video = await Video.create({
      owner: userA._id,
      title: 'Original Title',
      description: 'Original Description',
      visibility: 'public',
      status: 'ready',
    });

    const res = await request(app)
      .patch(`/api/videos/${video._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Updated Title',
        description: 'New Description',
        visibility: 'unlisted',
        tags: ['tutorial', 'coding'],
      });

    expect(res.status).toBe(200);
    expect(res.body.video.title).toBe('Updated Title');
    expect(res.body.video.visibility).toBe('unlisted');
    expect(res.body.video.tags).toEqual(['tutorial', 'coding']);
  });

  it('DELETE /api/videos/:id removes the video, jobs, and local media files', async () => {
    const toDelete = await Video.create({
      owner: userA._id,
      title: 'Video to delete',
      status: 'ready',
    });

    const mediaDir = path.join(TEMP_BASE, toDelete._id.toString());
    await fs.promises.mkdir(mediaDir, { recursive: true });
    await fs.promises.writeFile(path.join(mediaDir, 'test.ts'), 'dummy ts segment');

    await Job.create({
      video: toDelete._id,
      status: 'done',
    });

    const res = await request(app)
      .delete(`/api/videos/${toDelete._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkVideo = await Video.findById(toDelete._id);
    expect(checkVideo).toBeNull();

    const checkJob = await Job.findOne({ video: toDelete._id });
    expect(checkJob).toBeNull();

    expect(fs.existsSync(mediaDir)).toBe(false);
  });

  it('DELETE /api/videos/:id rejects non-owner with 403 FORBIDDEN', async () => {
    const video = await Video.create({
      owner: userA._id,
      title: 'Protected Video',
      status: 'ready',
    });

    const res = await request(app)
      .delete(`/api/videos/${video._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
