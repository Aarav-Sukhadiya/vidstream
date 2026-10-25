const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Search, Tag Filtering and Related Videos Suite (Checkpoint 18)', () => {
  let searchUser;
  let videoTitleMatch;
  let videoDescMatch;
  let videoWithTags1;
  let videoWithTags2;
  let privateVideo;

  beforeAll(async () => {
    await connectDB();
    await Video.deleteMany({});
    await User.deleteMany({ email: 'search_user@test.com' });

    searchUser = await User.create({
      email: 'search_user@test.com',
      passwordHash: 'dummyhash',
      handle: 'search_user',
      displayName: 'Search Tester',
    });

    const now = Date.now();

    // 1. Title match vs Description match videos
    videoTitleMatch = await Video.create({
      owner: searchUser._id,
      title: 'Binary Trees Comprehensive Guide',
      description: 'An overview of basic computer science data structures',
      tags: ['trees', 'dsa'],
      visibility: 'public',
      status: 'ready',
      viewCount: 100,
      publishedAt: new Date(now - 10000),
    });

    videoDescMatch = await Video.create({
      owner: searchUser._id,
      title: 'Intro to Computer Science',
      description: 'In this lecture we cover recursion and binary trees in depth',
      tags: ['intro', 'cs'],
      visibility: 'public',
      status: 'ready',
      viewCount: 500,
      publishedAt: new Date(now - 20000),
    });

    // 2. Tag matching videos
    videoWithTags1 = await Video.create({
      owner: searchUser._id,
      title: 'React 19 Deep Dive',
      description: 'Understanding actions and compiler',
      tags: ['react', 'frontend'],
      visibility: 'public',
      status: 'ready',
      viewCount: 1500,
      publishedAt: new Date(now - 5000),
    });

    videoWithTags2 = await Video.create({
      owner: searchUser._id,
      title: 'Advanced React Hooks',
      description: 'Custom hooks patterns',
      tags: ['react', 'javascript'],
      visibility: 'public',
      status: 'ready',
      viewCount: 800,
      publishedAt: new Date(now - 3000),
    });

    // 3. Private video
    privateVideo = await Video.create({
      owner: searchUser._id,
      title: 'Private Draft Trees',
      description: 'Confidential binary trees',
      tags: ['trees'],
      visibility: 'private',
      status: 'ready',
      publishedAt: new Date(now),
    });
  });

  afterAll(async () => {
    if (searchUser) {
      await Video.deleteMany({ owner: searchUser._id });
      await User.deleteOne({ _id: searchUser._id });
    }
    await disconnectDB();
  });

  describe('1. Text Search Ranking', () => {
    it('ranks title match above description match', async () => {
      const res = await request(app)
        .get('/api/videos?q=binary trees&sort=relevance')
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);

      // videoTitleMatch should be the first result
      expect(res.body.items[0].id).toBe(videoTitleMatch._id.toString());
      expect(res.body.items[0].title).toBe('Binary Trees Comprehensive Guide');

      // videoDescMatch should appear after title match
      const ids = res.body.items.map((item) => item.id);
      expect(ids.indexOf(videoTitleMatch._id.toString())).toBeLessThan(
        ids.indexOf(videoDescMatch._id.toString())
      );
    });

    it('handles query containing special regex characters without error (q=a(b returns 200)', async () => {
      const res = await request(app)
        .get('/api/videos?q=a(b')
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('handles complex symbols and unclosed punctuation in q safely', async () => {
      const symbols = ['[test]', 'regex.*', '"unclosed quote', 'a+b', 'c\\d'];
      for (const sym of symbols) {
        const res = await request(app)
          .get(`/api/videos?q=${encodeURIComponent(sym)}`)
          .expect(200);
        expect(res.body).toHaveProperty('items');
      }
    });
  });

  describe('2. Tag Filter', () => {
    it('filters videos by tag correctly', async () => {
      const res = await request(app)
        .get('/api/videos?tag=react')
        .expect(200);

      expect(res.body.items.length).toBe(2);
      for (const item of res.body.items) {
        expect(item.tags).toContain('react');
      }
    });

    it('ignores tag filter when tag is "all"', async () => {
      const res = await request(app)
        .get('/api/videos?tag=All')
        .expect(200);

      // Should return all 4 public ready videos
      expect(res.body.items.length).toBe(4);
    });
  });

  describe('3. Sorting', () => {
    it('sorts by views descending when sort=views', async () => {
      const res = await request(app)
        .get('/api/videos?sort=views')
        .expect(200);

      expect(res.body.items.length).toBe(4);
      for (let i = 0; i < res.body.items.length - 1; i++) {
        expect(res.body.items[i].viewCount).toBeGreaterThanOrEqual(
          res.body.items[i + 1].viewCount
        );
      }
    });
  });

  describe('4. Related Videos', () => {
    it('returns related videos sharing tags and strictly excludes current video', async () => {
      const res = await request(app)
        .get(`/api/videos/${videoWithTags1._id}/related`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);

      const returnedIds = res.body.items.map((v) => v.id);
      // Strictly excludes current video
      expect(returnedIds).not.toContain(videoWithTags1._id.toString());

      // videoWithTags2 shares the tag 'react' and should be included
      expect(returnedIds).toContain(videoWithTags2._id.toString());
    });

    it('returns 404 for non-existent video', async () => {
      const fakeId = '666666666666666666666666';
      await request(app)
        .get(`/api/videos/${fakeId}/related`)
        .expect(404);
    });

    it('returns 404 for private video when accessed as a guest', async () => {
      await request(app)
        .get(`/api/videos/${privateVideo._id}/related`)
        .expect(404);
    });
  });
});
