const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Home Feed & Cursor Pagination Suite (Checkpoint 17)', () => {
  let feedUser;

  beforeAll(async () => {
    await connectDB();
    await Video.deleteMany({});
    await User.deleteMany({ email: 'feed_author@test.com' });

    feedUser = await User.create({
      email: 'feed_author@test.com',
      passwordHash: 'dummyhash',
      handle: 'feed_author',
      displayName: 'Feed Author',
    });

    // Create 15 public ready videos with distinct publishedAt timestamps
    const now = Date.now();
    const videoDocs = [];
    for (let i = 1; i <= 15; i++) {
      videoDocs.push({
        owner: feedUser._id,
        title: `Public Video ${i < 10 ? '0' + i : i}`,
        visibility: 'public',
        status: 'ready',
        publishedAt: new Date(now - (16 - i) * 60000), // oldest to newest
        tags: i % 2 === 0 ? ['coding'] : ['general'],
      });
    }

    // Also add one private and one processing video to verify filtering
    videoDocs.push({
      owner: feedUser._id,
      title: 'Secret Private Video',
      visibility: 'private',
      status: 'ready',
      publishedAt: new Date(),
    });
    videoDocs.push({
      owner: feedUser._id,
      title: 'Unready Processing Video',
      visibility: 'public',
      status: 'processing',
      publishedAt: new Date(),
    });

    await Video.create(videoDocs);
  });

  afterAll(async () => {
    if (feedUser) {
      await Video.deleteMany({ owner: feedUser._id });
      await User.deleteOne({ _id: feedUser._id });
    }
    await disconnectDB();
  });

  it('GET /api/videos returns only public ready videos with cursor pagination', async () => {
    // Request page 1 with limit 10
    const page1Res = await request(app).get('/api/videos?limit=10');
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.items).toHaveLength(10);
    expect(page1Res.body.nextCursor).toBeDefined();

    // Verify private and processing videos are NOT included
    const titles1 = page1Res.body.items.map((v) => v.title);
    expect(titles1).not.toContain('Secret Private Video');
    expect(titles1).not.toContain('Unready Processing Video');

    // Request page 2 using nextCursor
    const page2Res = await request(app).get(`/api/videos?limit=10&cursor=${page1Res.body.nextCursor}`);
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.items).toHaveLength(5);
    expect(page2Res.body.nextCursor).toBeNull();

    const titles2 = page2Res.body.items.map((v) => v.title);

    // Verify NO overlap between page 1 and page 2
    const overlap = titles1.filter((t) => titles2.includes(t));
    expect(overlap).toHaveLength(0);

    // Total unique items across both pages should be exactly 15
    const totalTitles = [...titles1, ...titles2];
    expect(new Set(totalTitles).size).toBe(15);
  });

  it('GET /api/videos?tag=coding filters by tag', async () => {
    const res = await request(app).get('/api/videos?tag=coding');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    res.body.items.forEach((v) => {
      expect(v.tags).toContain('coding');
    });
  });
});
