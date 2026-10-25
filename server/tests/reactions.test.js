const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Reaction = require('../src/models/Reaction');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Atomic Reactions & Likes Suite (Checkpoint 15)', () => {
  let userA, userB;
  let tokenA, tokenB;
  let video;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['react_user_a@test.com', 'react_user_b@test.com'] } });

    userA = await User.create({
      email: 'react_user_a@test.com',
      passwordHash: 'dummyhash',
      handle: 'react_a',
      displayName: 'React A',
    });

    userB = await User.create({
      email: 'react_user_b@test.com',
      passwordHash: 'dummyhash',
      handle: 'react_b',
      displayName: 'React B',
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);

    video = await Video.create({
      owner: userA._id,
      title: 'Reaction Test Video',
      status: 'ready',
      likeCount: 0,
      dislikeCount: 0,
    });
  });

  afterAll(async () => {
    if (userA && userB) {
      await Reaction.deleteMany({ video: video._id });
      await Video.deleteOne({ _id: video._id });
      await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    }
    await disconnectDB();
  });

  it('PUT /api/videos/:id/reaction rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .send({ value: 1 });

    expect(res.status).toBe(401);
  });

  it('Liking an unreacted video sets reaction and increments likeCount', async () => {
    const res = await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.likeCount).toBe(1);
    expect(res.body.dislikeCount).toBe(0);

    const check = await Video.findById(video._id);
    expect(check.likeCount).toBe(1);
  });

  it('Repeated like is idempotent and does not double count', async () => {
    const res = await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: 1 });

    expect(res.status).toBe(200);
    expect(res.body.likeCount).toBe(1);

    const check = await Video.findById(video._id);
    expect(check.likeCount).toBe(1);
  });

  it('Switching from like to dislike adjusts counters atomically', async () => {
    const res = await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: -1 });

    expect(res.status).toBe(200);
    expect(res.body.likeCount).toBe(0);
    expect(res.body.dislikeCount).toBe(1);

    const check = await Video.findById(video._id);
    expect(check.likeCount).toBe(0);
    expect(check.dislikeCount).toBe(1);
  });

  it('Clearing reaction with value: 0 resets count', async () => {
    const res = await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: 0 });

    expect(res.status).toBe(200);
    expect(res.body.likeCount).toBe(0);
    expect(res.body.dislikeCount).toBe(0);

    const check = await Video.findById(video._id);
    expect(check.dislikeCount).toBe(0);
  });

  it('Multiple users can react independently', async () => {
    await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ value: 1 });

    await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ value: 1 });

    const check = await Video.findById(video._id);
    expect(check.likeCount).toBe(2);
  });
});
