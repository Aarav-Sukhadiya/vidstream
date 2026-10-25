const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Job = require('../src/models/Job');
const { cloudinary } = require('../src/services/storage');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Upload Confirmation & Transcode Job Enqueue Suite (Checkpoint 7)', () => {
  let authToken;
  let testUser;
  let videoDoc;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: 'confirm_tester@vidstreamtest.com' });

    const regRes = await request(app).post('/api/auth/register').send({
      email: 'confirm_tester@vidstreamtest.com',
      password: 'Password123!',
      handle: 'confirm_tester',
      displayName: 'Confirm Tester',
    });

    authToken = regRes.body.accessToken;
    testUser = regRes.body.user;
  });

  afterAll(async () => {
    await Video.deleteMany({ owner: testUser._id });
    await Job.deleteMany({});
    await User.deleteMany({ email: 'confirm_tester@vidstreamtest.com' });
    await disconnectDB();
  });

  beforeEach(async () => {
    await Video.deleteMany({ owner: testUser._id });
    await Job.deleteMany({});

    // Create a video in awaiting_upload state
    videoDoc = await Video.create({
      owner: testUser._id,
      title: 'Trees and Traversals',
      description: 'Worked examples in C++',
      tags: ['dsa', 'trees'],
      visibility: 'public',
      status: 'awaiting_upload',
    });
  });

  it('POST /videos/:id/confirm transitions video to queued and enqueues a Job in MongoDB', async () => {
    const res = await request(app)
      .post(`/api/videos/${videoDoc._id}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        public_id: `vidstream/raw/${videoDoc._id}`,
        secure_url: 'https://res.cloudinary.com/demo/video/upload/sample.mp4',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('video');
    expect(res.body.video.id).toBe(videoDoc._id.toString());
    expect(res.body.video.status).toBe('queued');

    // Verify Video in database is queued
    const updatedVideo = await Video.findById(videoDoc._id);
    expect(updatedVideo.status).toBe('queued');
    expect(updatedVideo.sourcePublicId).toBe(`vidstream/raw/${videoDoc._id}`);

    // Verify Job exists in MongoDB
    const job = await Job.findOne({ video: videoDoc._id });
    expect(job).toBeDefined();
    expect(job.status).toBe('queued');
    expect(job.type).toBe('transcode');
    expect(job.attempts).toBe(0);
  });

  it('POST /videos/:id/confirm rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post(`/api/videos/${videoDoc._id}/confirm`)
      .send({ public_id: `vidstream/raw/${videoDoc._id}` });

    expect(res.status).toBe(401);
  });

  it('POST /videos/:id/confirm rejects non-owner with 403 FORBIDDEN', async () => {
    // Create another user
    const otherUserRes = await request(app).post('/api/auth/register').send({
      email: 'other_user@vidstreamtest.com',
      password: 'Password123!',
      handle: 'other_user',
      displayName: 'Other User',
    });

    const res = await request(app)
      .post(`/api/videos/${videoDoc._id}/confirm`)
      .set('Authorization', `Bearer ${otherUserRes.body.accessToken}`)
      .send({ public_id: `vidstream/raw/${videoDoc._id}` });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    await User.deleteOne({ _id: otherUserRes.body.user._id });
  });

  it('POST /webhooks/cloudinary processes upload notification, updates status, and enqueues Job', async () => {
    const webhookPayload = {
      notification_type: 'upload',
      public_id: `vidstream/raw/${videoDoc._id}`,
      secure_url: 'https://res.cloudinary.com/demo/video/upload/trees.mp4',
      bytes: 48211034,
      format: 'mp4',
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.webhook_signature(
      JSON.stringify(webhookPayload),
      timestamp,
      { api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret' }
    );

    const res = await request(app)
      .post('/webhooks/cloudinary')
      .set('x-cld-timestamp', timestamp.toString())
      .set('x-cld-signature', signature)
      .send(webhookPayload);

    expect(res.status).toBe(202);
    expect(res.body.video.status).toBe('queued');

    // Verify Video in database
    const updatedVideo = await Video.findById(videoDoc._id);
    expect(updatedVideo.status).toBe('queued');
    expect(updatedVideo.sourcePublicId).toBe(`vidstream/raw/${videoDoc._id}`);

    // Verify Job in database
    const job = await Job.findOne({ video: videoDoc._id });
    expect(job).toBeDefined();
    expect(job.status).toBe('queued');
  });

  it('POST /webhooks/cloudinary rejects invalid signature with 400 VALIDATION', async () => {
    const webhookPayload = {
      notification_type: 'upload',
      public_id: `vidstream/raw/${videoDoc._id}`,
    };

    const res = await request(app)
      .post('/webhooks/cloudinary')
      .set('x-cld-timestamp', '123456')
      .set('x-cld-signature', 'forged_invalid_signature')
      .send(webhookPayload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('POST /webhooks/cloudinary returns 404 for unknown video ID', async () => {
    const unknownId = '6730c1f2a9b4e5d1c0a1b2c3';
    const payload = {
      notification_type: 'upload',
      public_id: `vidstream/raw/${unknownId}`,
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.webhook_signature(
      JSON.stringify(payload),
      timestamp,
      { api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret' }
    );

    const res = await request(app)
      .post('/webhooks/cloudinary')
      .set('x-cld-timestamp', timestamp.toString())
      .set('x-cld-signature', signature)
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
