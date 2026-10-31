/**
 * Seed demo creators, videos and community activity.
 *
 *   npm run seed                 # local database
 *   npm run seed -- --yes        # required for any non-local database (e.g. Atlas)
 *
 * Only data belonging to the demo accounts is replaced; other users and their
 * content are left alone. Output is deterministic, so re-running is safe.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Subscription = require('../src/models/Subscription');
const Comment = require('../src/models/Comment');
const Reaction = require('../src/models/Reaction');
const WatchProgress = require('../src/models/WatchProgress');
const ViewEvent = require('../src/models/ViewEvent');
const Job = require('../src/models/Job');
const {
  STREAMS,
  TECH_THUMBNAILS,
  USERS,
  VIDEOS,
  COMMENT_TEMPLATES,
  REPLY_TEMPLATES,
  unsplash,
} = require('./data');

const DEMO_PASSWORD = 'Password123!';
const DAY = 24 * 60 * 60 * 1000;
const { ObjectId } = mongoose.Types;

// Small deterministic PRNG so every run produces the same data
function createRandom(seed) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sample: (arr, n) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, n);
    },
  };
}

const hex2 = (n) => n.toString(16).padStart(2, '0');
const userId = (index) => new ObjectId(`65a0000000000000000000${hex2(index + 1)}`);
// The first video keeps its historical id so existing links keep working
const videoId = (index) =>
  new ObjectId(index === 0 ? '6adde8c64744aff2b00565bc' : `65a0000000000000000000${hex2(index + 10)}`);

function formatTimestamp(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function assertSeedTargetAllowed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vidstream';
  let host = '';
  try {
    host = new URL(uri).hostname;
  } catch {
    // treat unparseable as remote
  }
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  if (!isLocal && !process.argv.includes('--yes')) {
    throw new Error(
      `Refusing to seed remote database "${host}". Re-run with "--yes" to confirm (npm run seed -- --yes).`
    );
  }
  return host || uri;
}

function buildVideos(rand, users) {
  const now = Date.now();
  const total = VIDEOS.length;

  return VIDEOS.map(([ownerKey, title, description, tags], i) => {
    const stream = STREAMS[(i * 3) % STREAMS.length];
    const viewCount = Math.round(300 + rand.next() ** 2 * 14000);
    const ageDays = ((total - i) / total) * 60; // oldest ~60 days ago, newest today
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

    return {
      _id: videoId(i),
      owner: users[ownerKey]._id,
      title,
      description,
      tags,
      visibility: 'public',
      status: 'ready',
      hlsUrl: stream.url,
      thumbnailUrl:
        i < TECH_THUMBNAILS.length
          ? unsplash(TECH_THUMBNAILS[i])
          : `https://picsum.photos/seed/vidstream-${slug}/640/360`,
      durationSec: stream.durationSec,
      viewCount,
      // popularity baseline; real reactions from demo users are added on top later
      likeCount: Math.round(viewCount * (0.04 + rand.next() * 0.06)),
      dislikeCount: Math.round(viewCount * rand.next() * 0.004),
      commentCount: 0,
      publishedAt: new Date(now - ageDays * DAY - rand.int(0, 20) * 3600 * 1000),
    };
  });
}

function buildActivity(rand, userList, videos) {
  const now = Date.now();
  const subscriptions = [];
  const comments = [];
  const reactions = [];
  const progress = [];
  const between = (start) =>
    new Date(start.getTime() + rand.next() * Math.max(0, now - start.getTime()));

  // Each creator follows 3-5 other creators
  for (const user of userList) {
    const others = userList.filter((u) => u._id !== user._id);
    for (const channel of rand.sample(others, rand.int(3, 5))) {
      const at = new Date(now - rand.int(1, 50) * DAY);
      subscriptions.push({ _id: new ObjectId(), subscriber: user._id, channel: channel._id, createdAt: at, updatedAt: at });
    }
  }

  for (const video of videos) {
    const nonOwners = userList.filter((u) => !u._id.equals(video.owner));
    const owner = userList.find((u) => u._id.equals(video.owner));

    // 1-5 top-level comments, some with replies from the creator or other viewers
    for (const author of rand.sample(nonOwners, rand.int(1, 5))) {
      const at = between(video.publishedAt);
      const t = formatTimestamp(rand.int(5, Math.max(6, video.durationSec - 5)));
      const top = {
        _id: new ObjectId(),
        video: video._id,
        author: author._id,
        parent: null,
        body: rand.pick(COMMENT_TEMPLATES).replace('{t}', t),
        createdAt: at,
        updatedAt: at,
      };
      comments.push(top);

      if (rand.next() < 0.45) {
        const replier = rand.next() < 0.7 ? owner : rand.pick(nonOwners);
        const replyAt = between(at);
        comments.push({
          _id: new ObjectId(),
          video: video._id,
          author: replier._id,
          parent: top._id,
          body: rand.pick(REPLY_TEMPLATES),
          createdAt: replyAt,
          updatedAt: replyAt,
        });
      }
    }
  }

  // Each user likes 8-14 videos, dislikes 0-2, and has some watch history
  for (const user of userList) {
    const others = videos.filter((v) => !v.owner.equals(user._id));
    const picked = rand.sample(others, rand.int(8, 16));
    const dislikeCount = rand.int(0, 2);

    picked.forEach((video, i) => {
      const at = between(video.publishedAt);
      reactions.push({
        _id: new ObjectId(),
        user: user._id,
        video: video._id,
        value: i < dislikeCount ? -1 : 1,
        createdAt: at,
        updatedAt: at,
      });
    });

    for (const video of rand.sample(others, rand.int(4, 8))) {
      const at = new Date(now - rand.int(0, 14) * DAY - rand.int(0, 23) * 3600 * 1000);
      progress.push({
        _id: new ObjectId(),
        user: user._id,
        video: video._id,
        positionSec: rand.int(10, Math.max(11, video.durationSec - 10)),
        durationSec: video.durationSec,
        createdAt: at,
        updatedAt: at,
      });
    }
  }

  return { subscriptions, comments, reactions, progress };
}

/** Recompute denormalised counters from the real documents (plus seeded baselines). */
async function recomputeCounters(videos, userList) {
  const videoIds = videos.map((v) => v._id);

  const [commentCounts, reactionCounts, subscriberCounts] = await Promise.all([
    Comment.aggregate([
      { $match: { video: { $in: videoIds } } },
      { $group: { _id: '$video', n: { $sum: 1 } } },
    ]),
    Reaction.aggregate([
      { $match: { video: { $in: videoIds } } },
      { $group: { _id: { video: '$video', value: '$value' }, n: { $sum: 1 } } },
    ]),
    Subscription.aggregate([
      { $match: { channel: { $in: userList.map((u) => u._id) } } },
      { $group: { _id: '$channel', n: { $sum: 1 } } },
    ]),
  ]);

  const key = (id) => id.toString();
  const comments = new Map(commentCounts.map((c) => [key(c._id), c.n]));
  const likes = new Map();
  const dislikes = new Map();
  for (const r of reactionCounts) {
    (r._id.value === 1 ? likes : dislikes).set(key(r._id.video), r.n);
  }

  await Video.bulkWrite(
    videos.map((v) => ({
      updateOne: {
        filter: { _id: v._id },
        update: {
          $set: {
            commentCount: comments.get(key(v._id)) || 0,
            likeCount: v.likeCount + (likes.get(key(v._id)) || 0),
            dislikeCount: v.dislikeCount + (dislikes.get(key(v._id)) || 0),
          },
        },
      },
    }))
  );

  const subs = new Map(subscriberCounts.map((s) => [key(s._id), s.n]));
  await User.bulkWrite(
    userList.map((u) => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { subscriberCount: u.baseSubscribers + (subs.get(key(u._id)) || 0) } },
      },
    }))
  );
}

async function seed() {
  const target = assertSeedTargetAllowed();
  console.log(`[Seed] Connecting to ${target}...`);
  await connectDB();

  try {
    const rand = createRandom(20261101);

    // --- Remove previous demo data only ---------------------------------------
    const demoEmails = USERS.map((u) => u.email);
    const existing = await User.find({ email: { $in: demoEmails } }).select('_id');
    const demoUserIds = [...existing.map((u) => u._id), ...USERS.map((_, i) => userId(i))];
    const oldVideoIds = (await Video.find({ owner: { $in: demoUserIds } }).select('_id')).map((v) => v._id);
    const demoVideoIds = [...oldVideoIds, ...VIDEOS.map((_, i) => videoId(i))];
    const oldCommentIds = (await Comment.find({ author: { $in: demoUserIds } }).select('_id')).map((c) => c._id);

    console.log('[Seed] Clearing previous demo data...');
    await Promise.all([
      Video.deleteMany({ _id: { $in: demoVideoIds } }),
      Subscription.deleteMany({ $or: [{ subscriber: { $in: demoUserIds } }, { channel: { $in: demoUserIds } }] }),
      Comment.deleteMany({ $or: [{ _id: { $in: oldCommentIds } }, { parent: { $in: oldCommentIds } }] }),
      Reaction.deleteMany({ user: { $in: demoUserIds } }),
      WatchProgress.deleteMany({ user: { $in: demoUserIds } }),
      ViewEvent.deleteMany({ video: { $in: demoVideoIds } }),
      Job.deleteMany({ video: { $in: demoVideoIds } }),
    ]);
    await User.deleteMany({ $or: [{ email: { $in: demoEmails } }, { _id: { $in: demoUserIds } }] });

    // --- Users --------------------------------------------------------------------
    console.log(`[Seed] Creating ${USERS.length} demo creators...`);
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const userDocs = USERS.map((u, i) => ({
      _id: userId(i),
      email: u.email,
      handle: u.handle,
      displayName: u.displayName,
      bio: u.bio,
      avatarUrl: u.avatarUrl,
      passwordHash,
      subscriberCount: u.baseSubscribers,
    }));
    await User.insertMany(userDocs);
    const userList = USERS.map((u, i) => ({ ...u, _id: userDocs[i]._id }));
    const users = Object.fromEntries(userList.map((u) => [u.key, u]));

    // --- Videos & activity ----------------------------------------------------------
    const videos = buildVideos(rand, users);
    console.log(`[Seed] Creating ${videos.length} videos...`);
    await Video.insertMany(videos);

    const { subscriptions, comments, reactions, progress } = buildActivity(rand, userList, videos);
    console.log(
      `[Seed] Creating ${subscriptions.length} subscriptions, ${comments.length} comments, ` +
        `${reactions.length} reactions and ${progress.length} watch-history entries...`
    );
    // Raw inserts keep the explicit historical createdAt/updatedAt values
    await Promise.all([
      Subscription.collection.insertMany(subscriptions),
      Comment.collection.insertMany(comments),
      Reaction.collection.insertMany(reactions),
      WatchProgress.collection.insertMany(progress),
    ]);

    await recomputeCounters(videos, userList);

    // Make sure indexes (incl. the text index used by search) exist
    await Promise.all([Video, Comment, Reaction, Subscription, WatchProgress, User].map((m) => m.syncIndexes()));

    console.log(`[Seed] Done. Sign in with any demo account, password "${DEMO_PASSWORD}".`);
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seed };
