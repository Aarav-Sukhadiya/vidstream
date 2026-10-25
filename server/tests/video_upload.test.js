const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Video Model & Presigned Upload Endpoint Suite (Checkpoint 6)', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: 'uploader@vidstreamtest.com' });

    const regRes = await request(app).post('/api/auth/register').send({
      email: 'uploader@vidstreamtest.com',
      password: 'Password123!',
      handle: 'uploader_maya',
      displayName: 'Maya Uploader',
    });

    authToken = regRes.body.accessToken;
    testUserId = regRes.body.user._id;
  });

  afterAll(async () => {
    await Video.deleteMany({ owner: testUserId });
    await User.deleteMany({ email: 'uploader@vidstreamtest.com' });
    await disconnectDB();
  });

  beforeEach(async () => {
    await Video.deleteMany({ owner: testUserId });
  });

  const validVideoPayload = {
    title: 'Binary trees in 10 minutes',
    description: 'Traversals and a worked example',
    tags: ['dsa', 'trees'],
    visibility: 'public',
    fileName: 'trees.mp4',
    contentType: 'video/mp4',
    sizeBytes: 48211034, // ~46MB
  };

  it('POST /videos requires authentication and returns 401 if unauthenticated', async () => {
    const res = await request(app).post('/api/videos').send(validVideoPayload);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /videos returns 201 with signed upload parameters and creates awaiting_upload record', async () => {
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${authToken}`)
      .send(validVideoPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('video');
    expect(res.body.video).toHaveProperty('id');
    expect(res.body.video.status).toBe('awaiting_upload');

    expect(res.body).toHaveProperty('upload');
    expect(res.body.upload).toHaveProperty('url');
    expect(res.body.upload.url).toMatch(/https:\/\/api\.cloudinary\.com/);
    expect(res.body.upload.method).toBe('POST');
    expect(res.body.upload).toHaveProperty('fields');
    expect(res.body.upload.fields).toHaveProperty('api_key');
    expect(res.body.upload.fields).toHaveProperty('timestamp');
    expect(res.body.upload.fields).toHaveProperty('signature');
    expect(res.body.upload.fields).toHaveProperty('folder');
    expect(res.body.upload.fields).toHaveProperty('upload_preset');
    expect(res.body.upload.expiresInSec).toBe(900);

    // Verify database document
    const videoInDb = await Video.findById(res.body.video.id);
    expect(videoInDb).toBeDefined();
    expect(videoInDb.title).toBe(validVideoPayload.title);
    expect(videoInDb.status).toBe('awaiting_upload');
    expect(videoInDb.owner.toString()).toBe(testUserId.toString());
    expect(videoInDb.tags).toEqual(['dsa', 'trees']);
  });

  it('POST /videos rejects .exe file names with 400 VALIDATION', async () => {
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...validVideoPayload,
        fileName: 'malicious.exe',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('fileName');
  });

  it('POST /videos rejects non-video content types (e.g. application/octet-stream) with 400', async () => {
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...validVideoPayload,
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('contentType');
  });

  it('POST /videos rejects oversized video files exceeding MAX_UPLOAD_MB with 400', async () => {
    // 101 MB (exceeds default 100 MB limit)
    const oversizedBytes = 101 * 1024 * 1024;
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...validVideoPayload,
        sizeBytes: oversizedBytes,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('sizeBytes');
  });

  it('POST /videos rejects invalid or empty title with 400', async () => {
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...validVideoPayload,
        title: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('title');
  });

  it('POST /videos rejects more than 10 tags with 400', async () => {
    const res = await request(app)
      .post('/api/videos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...validVideoPayload,
        tags: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('tags');
  });
});
