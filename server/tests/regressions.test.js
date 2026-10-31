const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Comment = require('../src/models/Comment');
const Reaction = require('../src/models/Reaction');
const WatchProgress = require('../src/models/WatchProgress');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB, assertSafeTestUri } = require('../src/config/db');
const { downloadToFile } = require('../src/workers');

describe('Regression suite for cleanup/bug-fix pass', () => {
  let owner, other, ownerToken, otherToken;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: /@regression\.test$/ });
    owner = await User.create({
      email: 'owner@regression.test',
      passwordHash: 'x',
      handle: 'reg_owner',
      displayName: 'Owner',
    });
    other = await User.create({
      email: 'other@regression.test',
      passwordHash: 'x',
      handle: 'reg_other',
      displayName: 'Other',
    });
    ownerToken = generateAccessToken(owner);
    otherToken = generateAccessToken(other);
  });

  afterEach(async () => {
    const ids = [owner._id, other._id];
    const videos = await Video.find({ owner: { $in: ids } }).select('_id');
    const videoIds = videos.map((v) => v._id);
    await Promise.all([
      Comment.deleteMany({ video: { $in: videoIds } }),
      Reaction.deleteMany({ video: { $in: videoIds } }),
      WatchProgress.deleteMany({ video: { $in: videoIds } }),
      Video.deleteMany({ _id: { $in: videoIds } }),
    ]);
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@regression\.test$/ });
    await disconnectDB();
  });

  const makeVideo = (overrides = {}) =>
    Video.create({
      owner: owner._id,
      title: 'Regression video',
      status: 'ready',
      visibility: 'public',
      publishedAt: new Date(),
      ...overrides,
    });

  it('refuses to run tests against a remote database', () => {
    expect(() => assertSafeTestUri('mongodb+srv://u:p@cluster0.example.net/db')).toThrow(/non-local/);
    expect(() => assertSafeTestUri('mongodb://127.0.0.1:27017/db')).not.toThrow();
  });

  it('includes a string `id` in serialized users', async () => {
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(owner._id.toString());
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects malformed ObjectIds with 400 instead of a database error', async () => {
    const res = await request(app).get('/api/videos/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('validates PATCH /videos/:id input', async () => {
    const video = await makeVideo();
    const auth = { Authorization: `Bearer ${ownerToken}` };

    const empty = await request(app).patch(`/api/videos/${video._id}`).set(auth).send({ title: '  ' });
    expect(empty.status).toBe(400);

    const badVis = await request(app)
      .patch(`/api/videos/${video._id}`)
      .set(auth)
      .send({ visibility: 'everyone' });
    expect(badVis.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/videos/${video._id}`)
      .set(auth)
      .send({ tags: ['React', 'react', ''] });
    expect(ok.status).toBe(200);
    expect(ok.body.video.tags).toEqual(['react']);
  });

  it('deleting a video removes its comments, reactions and watch progress', async () => {
    const video = await makeVideo();
    await Comment.create({ video: video._id, author: other._id, body: 'hi' });
    await Reaction.create({ video: video._id, user: other._id, value: 1 });
    await WatchProgress.create({ video: video._id, user: other._id, positionSec: 5 });

    const res = await request(app)
      .delete(`/api/videos/${video._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);

    expect(await Comment.countDocuments({ video: video._id })).toBe(0);
    expect(await Reaction.countDocuments({ video: video._id })).toBe(0);
    expect(await WatchProgress.countDocuments({ video: video._id })).toBe(0);
  });

  it('does not expose comments or accept reactions on another user’s private video', async () => {
    const video = await makeVideo({ visibility: 'private' });
    await Comment.create({ video: video._id, author: owner._id, body: 'secret' });

    const comments = await request(app).get(`/api/videos/${video._id}/comments`);
    expect(comments.status).toBe(404);

    const reaction = await request(app)
      .put(`/api/videos/${video._id}/reaction`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ value: 1 });
    expect(reaction.status).toBe(404);

    const view = await request(app).post(`/api/videos/${video._id}/view`);
    expect(view.status).toBe(404);
  });

  it('rejects replies whose parent belongs to a different video and flattens nested replies', async () => {
    const videoA = await makeVideo();
    const videoB = await makeVideo();
    const parentOnB = await Comment.create({ video: videoB._id, author: owner._id, body: 'b' });
    const auth = { Authorization: `Bearer ${otherToken}` };

    const cross = await request(app)
      .post(`/api/videos/${videoA._id}/comments`)
      .set(auth)
      .send({ body: 'reply', parentId: parentOnB._id.toString() });
    expect(cross.status).toBe(404);

    const top = await Comment.create({ video: videoA._id, author: owner._id, body: 'top' });
    const reply = await Comment.create({ video: videoA._id, author: owner._id, body: 'r', parent: top._id });
    const nested = await request(app)
      .post(`/api/videos/${videoA._id}/comments`)
      .set(auth)
      .send({ body: 'nested', parentId: reply._id.toString() });
    expect(nested.status).toBe(201);
    expect(nested.body.comment.parentId).toBe(top._id.toString());
  });

  it('paginates comments without skipping items that share a timestamp', async () => {
    const video = await makeVideo();
    const at = new Date();
    await Comment.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        video: video._id,
        author: other._id,
        body: `c${i}`,
        createdAt: at,
        updatedAt: at,
      }))
    );

    const seen = new Set();
    let cursor = null;
    do {
      const res = await request(app)
        .get(`/api/videos/${video._id}/comments`)
        .query({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      res.body.items.forEach((c) => seen.add(c.id));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(seen.size).toBe(5);
  });

  it('keeps comment counts accurate when deleting a thread', async () => {
    const video = await makeVideo({ commentCount: 3 });
    const top = await Comment.create({ video: video._id, author: other._id, body: 't' });
    await Comment.create({ video: video._id, author: owner._id, body: 'r1', parent: top._id });
    await Comment.create({ video: video._id, author: owner._id, body: 'r2', parent: top._id });

    const res = await request(app)
      .delete(`/api/comments/${top._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(3);
    expect((await Video.findById(video._id)).commentCount).toBe(0);
  });

  it('paginates relevance-sorted search without duplicates', async () => {
    await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        makeVideo({ title: `Zyxwv lesson ${i}`, publishedAt: new Date(Date.now() - i * 1000) })
      )
    );

    const seen = [];
    let cursor = null;
    do {
      const res = await request(app)
        .get('/api/videos')
        .query({ q: 'zyxwv', sort: 'relevance', limit: 3, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      seen.push(...res.body.items.map((v) => v.id));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(seen.length).toBe(7);
    expect(new Set(seen).size).toBe(7);
  });

  it('ignores array-valued query params instead of crashing', async () => {
    const res = await request(app).get('/api/videos?q=a&q=b&tag=x&tag=y');
    expect(res.status).toBe(200);
  });

  it('validates progress payloads and only accepts viewable videos', async () => {
    const video = await makeVideo();
    const auth = { Authorization: `Bearer ${otherToken}` };

    const bad = await request(app).put(`/api/videos/${video._id}/progress`).set(auth).send({ positionSec: 'abc' });
    expect(bad.status).toBe(400);

    const missing = await request(app)
      .put('/api/videos/507f1f77bcf86cd799439011/progress')
      .set(auth)
      .send({ positionSec: 10 });
    expect(missing.status).toBe(404);
  });

  it('only serves HLS output from /media, never raw sources', async () => {
    const res = await request(app).get('/media/507f1f77bcf86cd799439011/source');
    expect(res.status).toBe(404);
  });

  it('confirm rejects a public_id that belongs to another video', async () => {
    const video = await makeVideo({ status: 'awaiting_upload' });
    const res = await request(app)
      .post(`/api/videos/${video._id}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ public_id: 'vidstream/raw/507f1f77bcf86cd799439011' });
    expect(res.status).toBe(400);
  });

  it('worker downloads remote sources and enforces the size limit', async () => {
    const payload = Buffer.alloc(2048, 1);
    const server = http.createServer((req, res) => res.end(payload));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/video`;
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vidstream-dl-'));

    try {
      const dest = path.join(dir, 'source');
      await downloadToFile(url, dest);
      expect((await fs.promises.stat(dest)).size).toBe(payload.length);

      const prev = process.env.MAX_UPLOAD_MB;
      process.env.MAX_UPLOAD_MB = '0.001'; // ~1KB
      await expect(downloadToFile(url, path.join(dir, 'too-big'))).rejects.toThrow(/maximum upload size/);
      if (prev === undefined) delete process.env.MAX_UPLOAD_MB;
      else process.env.MAX_UPLOAD_MB = prev;
      expect(fs.existsSync(path.join(dir, 'too-big'))).toBe(false);
    } finally {
      server.close();
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });
});
