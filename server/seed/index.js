require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Video = require('../src/models/Video');

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  try {
    console.log('[Seed] Clearing existing demo data...');
    const demoEmails = ['maya@vidstream.com', 'alex@vidstream.com', 'sam@vidstream.com'];
    const existingUsers = await User.find({ email: { $in: demoEmails } });
    const userIds = existingUsers.map((u) => u._id);

    await Video.deleteMany({ owner: { $in: userIds } });
    await User.deleteMany({ email: { $in: demoEmails } });

    console.log('[Seed] Creating demo users...');
    const defaultPasswordHash = await bcrypt.hash('Password123!', 12);

    const maya = await User.create({
      email: 'maya@vidstream.com',
      passwordHash: defaultPasswordHash,
      handle: 'maya',
      displayName: 'Maya Tech',
      bio: 'Full-stack engineer building distributed systems and teaching DSA.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      subscriberCount: 1420,
    });

    const alex = await User.create({
      email: 'alex@vidstream.com',
      passwordHash: defaultPasswordHash,
      handle: 'alex_dev',
      displayName: 'Alex Rivers',
      bio: 'Frontend architecture, modern CSS layouts, and UI performance.',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
      subscriberCount: 890,
    });

    const sam = await User.create({
      email: 'sam@vidstream.com',
      passwordHash: defaultPasswordHash,
      handle: 'sam_systems',
      displayName: 'Samira Khan',
      bio: 'DevOps, Kubernetes orchestration, and database scaling.',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
      subscriberCount: 2310,
    });

    console.log('[Seed] Creating 16 ready demo videos with public HLS streams...');
    const now = Date.now();
    const demoHlsStream = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    const videosData = [
      {
        owner: maya._id,
        title: 'Binary Search Trees in 10 Minutes',
        description: 'Complete walkthrough of binary search tree properties, tree traversals (inorder, preorder, postorder), and a worked insertion example.',
        tags: ['dsa', 'algorithms', 'trees', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc04f6c49c7?auto=format&fit=crop&w=640&q=80',
        durationSec: 612,
        viewCount: 1280,
        likeCount: 94,
        publishedAt: new Date(now - 14 * 86400000),
      },
      {
        owner: alex._id,
        title: 'React 19 Server Actions & Optimistic Updates',
        description: 'Deep dive into React 19 server actions, useActionState, and managing instant UI rollbacks on mutation failure.',
        tags: ['react', 'javascript', 'frontend'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=640&q=80',
        durationSec: 485,
        viewCount: 2430,
        likeCount: 182,
        publishedAt: new Date(now - 13 * 86400000),
      },
      {
        owner: sam._id,
        title: 'Designing Resilient Job Queues in MongoDB',
        description: 'How to build an atomic background worker queue with MongoDB findOneAndUpdate, exponential retry backoff, and lock timeouts.',
        tags: ['node', 'databases', 'system design', 'devops'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=640&q=80',
        durationSec: 740,
        viewCount: 3120,
        likeCount: 310,
        publishedAt: new Date(now - 12 * 86400000),
      },
      {
        owner: alex._id,
        title: 'Mastering CSS Grid and Subgrid with Real Examples',
        description: 'Practical guide to building complex responsive magazine and dashboard layouts using modern CSS Grid and subgrid.',
        tags: ['frontend', 'css', 'layout'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=640&q=80',
        durationSec: 395,
        viewCount: 890,
        likeCount: 76,
        publishedAt: new Date(now - 11 * 86400000),
      },
      {
        owner: maya._id,
        title: 'Dynamic Programming: From Recursion to Memoization',
        description: 'Breaking down hard dynamic programming problems systematically with state transition diagrams and space optimization.',
        tags: ['dsa', 'algorithms', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=640&q=80',
        durationSec: 820,
        viewCount: 4210,
        likeCount: 420,
        publishedAt: new Date(now - 10 * 86400000),
      },
      {
        owner: sam._id,
        title: 'Zero-Downtime Database Migrations in Production',
        description: 'Best practices for schema migrations, expand-contract patterns, and rolling zero-downtime deployments.',
        tags: ['databases', 'devops', 'system design'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=640&q=80',
        durationSec: 540,
        viewCount: 1650,
        likeCount: 145,
        publishedAt: new Date(now - 9 * 86400000),
      },
      {
        owner: maya._id,
        title: 'Building an End-to-End Video Transcoder in Node.js',
        description: 'Architecture breakdown of FFmpeg child process management, multi-bitrate HLS playlist composition, and thumbnail extraction.',
        tags: ['node', 'ffmpeg', 'system design', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=640&q=80',
        durationSec: 960,
        viewCount: 5120,
        likeCount: 520,
        publishedAt: new Date(now - 8 * 86400000),
      },
      {
        owner: sam._id,
        title: 'WebSockets vs Server-Sent Events vs Long Polling',
        description: 'Comprehensive comparison of real-time communication protocols for modern full-stack web applications.',
        tags: ['node', 'system design', 'architecture'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80',
        durationSec: 410,
        viewCount: 2980,
        likeCount: 260,
        publishedAt: new Date(now - 7 * 86400000),
      },
      {
        owner: maya._id,
        title: 'Distributed Caching Patterns with Redis',
        description: 'Cache-aside, write-through, and cache stampede prevention strategies for high-throughput microservices.',
        tags: ['system design', 'databases', 'node'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=80',
        durationSec: 675,
        viewCount: 3840,
        likeCount: 345,
        publishedAt: new Date(now - 6 * 86400000),
      },
      {
        owner: alex._id,
        title: 'TypeScript Generics and Conditional Types Mastery',
        description: 'Master advanced TypeScript type-level programming: mapped types, template literal types, and inference with infer.',
        tags: ['react', 'javascript', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=640&q=80',
        durationSec: 530,
        viewCount: 2190,
        likeCount: 210,
        publishedAt: new Date(now - 5 * 86400000),
      },
      {
        owner: sam._id,
        title: 'Dockerizing Full-Stack Node and React Applications',
        description: 'Step-by-step guide to writing optimized multi-stage Dockerfiles, caching npm dependencies, and deploying with Docker Compose.',
        tags: ['devops', 'node', 'react'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?auto=format&fit=crop&w=640&q=80',
        durationSec: 620,
        viewCount: 4720,
        likeCount: 460,
        publishedAt: new Date(now - 4 * 86400000),
      },
      {
        owner: maya._id,
        title: 'Graph Algorithms: Dijkstra and Bellman-Ford Explained',
        description: 'Visual intuition and Python/JavaScript implementations of shortest path algorithms on weighted directed graphs.',
        tags: ['dsa', 'algorithms', 'graph'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1527474305487-b87b222841cc?auto=format&fit=crop&w=640&q=80',
        durationSec: 780,
        viewCount: 3340,
        likeCount: 320,
        publishedAt: new Date(now - 3 * 86400000),
      },
      {
        owner: sam._id,
        title: 'PostgreSQL Indexing: B-Trees vs GIN vs GiST',
        description: 'Understanding query planning, EXPLAIN ANALYZE, and when to use partial or expression-based indexes.',
        tags: ['databases', 'system design', 'sql'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=640&q=80',
        durationSec: 490,
        viewCount: 1890,
        likeCount: 175,
        publishedAt: new Date(now - 2 * 86400000),
      },
      {
        owner: alex._id,
        title: 'Building Interactive 3D Web Graphics with Three.js',
        description: 'Get started with shaders, geometries, lighting, and performance-tuned animation loops in modern browsers.',
        tags: ['frontend', 'javascript', 'graphics'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=640&q=80',
        durationSec: 710,
        viewCount: 5600,
        likeCount: 580,
        publishedAt: new Date(now - 1 * 86400000),
      },
      {
        owner: sam._id,
        title: 'Kubernetes Autoscaling: HPA and KEDA Deep Dive',
        description: 'Auto-scaling stateless and event-driven workloads based on CPU, memory, and custom queue depth metrics.',
        tags: ['devops', 'kubernetes', 'system design'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=640&q=80',
        durationSec: 840,
        viewCount: 2750,
        likeCount: 290,
        publishedAt: new Date(now - 18 * 3600000),
      },
      {
        owner: alex._id,
        title: 'Tailwind CSS Tips for Production-Grade UI Design',
        description: 'Modern component composition, dark mode design tokens, micro-interactions, and accessibility best practices.',
        tags: ['frontend', 'css', 'react'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=640&q=80',
        durationSec: 450,
        viewCount: 6890,
        likeCount: 710,
        publishedAt: new Date(now - 6 * 3600000),
      },
    ];

    await Video.create(videosData);
    console.log(`[Seed] Successfully seeded 3 demo users and ${videosData.length} ready videos!`);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    throw err;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[Seed] Seeding completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Seeding failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seed };
