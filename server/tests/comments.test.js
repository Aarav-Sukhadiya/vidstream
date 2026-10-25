const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Comment = require('../src/models/Comment');
const { generateAccessToken } = require('../src/utils/tokens');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Comments, Replies & Permissions Suite (Checkpoint 16 - Gate 2)', () => {
  let authorA, authorB;
  let tokenA, tokenB;
  let video;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: ['commenter_a@test.com', 'commenter_b@test.com'] } });

    authorA = await User.create({
      email: 'commenter_a@test.com',
      passwordHash: 'dummyhash',
      handle: 'commenter_a',
      displayName: 'Commenter A',
    });

    authorB = await User.create({
      email: 'commenter_b@test.com',
      passwordHash: 'dummyhash',
      handle: 'commenter_b',
      displayName: 'Commenter B',
    });

    tokenA = generateAccessToken(authorA);
    tokenB = generateAccessToken(authorB);

    video = await Video.create({
      owner: authorA._id,
      title: 'Discussion Video',
      status: 'ready',
      commentCount: 0,
    });
  });

  afterAll(async () => {
    if (authorA && authorB) {
      await Comment.deleteMany({ video: video._id });
      await Video.deleteOne({ _id: video._id });
      await User.deleteMany({ _id: { $in: [authorA._id, authorB._id] } });
    }
    await disconnectDB();
  });

  it('POST /api/videos/:id/comments creates top-level comment and increments commentCount', async () => {
    const res = await request(app)
      .post(`/api/videos/${video._id}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Awesome tutorial! Check 02:15 for the tree insertion example.' });

    expect(res.status).toBe(201);
    expect(res.body.comment.body).toContain('02:15');
    expect(res.body.comment.author.handle).toBe('commenter_a');

    const checkVideo = await Video.findById(video._id);
    expect(checkVideo.commentCount).toBe(1);
  });

  it('POST /api/videos/:id/comments with parentId creates a nested reply', async () => {
    const parentComment = await Comment.findOne({ video: video._id, parent: null });

    const res = await request(app)
      .post(`/api/videos/${video._id}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        body: 'Thanks! That part helped me understand rotations.',
        parentId: parentComment._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.comment.author.handle).toBe('commenter_b');

    const checkVideo = await Video.findById(video._id);
    expect(checkVideo.commentCount).toBe(2);
  });

  it('GET /api/videos/:id/comments returns comments with author info and replyCount', async () => {
    const res = await request(app).get(`/api/videos/${video._id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);

    const topLevel = res.body.items[0];
    expect(topLevel.replyCount).toBe(1);
    expect(topLevel.author.handle).toBe('commenter_a');
  });

  it('DELETE /api/comments/:id by non-author returns 403 FORBIDDEN', async () => {
    const commentByA = await Comment.findOne({ author: authorA._id });

    // User B attempts to delete User A's comment
    const res = await request(app)
      .delete(`/api/comments/${commentByA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE /api/comments/:id by author deletes comment and updates commentCount', async () => {
    const commentByA = await Comment.findOne({ author: authorA._id, parent: null });

    const res = await request(app)
      .delete(`/api/comments/${commentByA._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkComment = await Comment.findById(commentByA._id);
    expect(checkComment).toBeNull();

    // Cascading deleted reply
    const checkReplies = await Comment.find({ parent: commentByA._id });
    expect(checkReplies).toHaveLength(0);

    const checkVideo = await Video.findById(video._id);
    expect(checkVideo.commentCount).toBe(0);
  });
});
