require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Subscription = require('../src/models/Subscription');
const Comment = require('../src/models/Comment');
const Reaction = require('../src/models/Reaction');
const WatchProgress = require('../src/models/WatchProgress');

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  try {
    console.log('[Seed] Clearing existing demo data...');
    const demoEmails = ['maya@vidstream.com', 'alex@vidstream.com', 'sam@vidstream.com'];
    const existingUsers = await User.find({ email: { $in: demoEmails } });
    const userIds = existingUsers.map((u) => u._id);

    await Video.deleteMany({ owner: { $in: userIds } });
    await Subscription.deleteMany({ $or: [{ subscriber: { $in: userIds } }, { channel: { $in: userIds } }] });
    await Comment.deleteMany({ author: { $in: userIds } });
    await Reaction.deleteMany({ user: { $in: userIds } });
    await WatchProgress.deleteMany({ user: { $in: userIds } });
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
        thumbnailUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=640&q=80',
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
        thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=640&q=80',
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
      {
        owner: maya._id,
        title: 'Rust for JavaScript Developers: Memory Safety Without GC',
        description: 'An intuitive bridge from JavaScript to Rust: borrowing, ownership rules, lifetimes, and why Rust produces blazing-fast WebAssembly.',
        tags: ['rust', 'system design', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-bf19f8fd1085?auto=format&fit=crop&w=640&q=80',
        durationSec: 740,
        viewCount: 8420,
        likeCount: 910,
        publishedAt: new Date(now - 5 * 3600000),
      },
      {
        owner: sam._id,
        title: 'Designing an Event-Driven Architecture with Apache Kafka',
        description: 'Partitioning strategies, consumer groups, exactly-once semantics, and handling schema evolution in production message streams.',
        tags: ['system design', 'devops', 'node'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=640&q=80',
        durationSec: 1120,
        viewCount: 4190,
        likeCount: 430,
        publishedAt: new Date(now - 4 * 3600000),
      },
      {
        owner: alex._id,
        title: 'Next.js 15 App Router: Server Components & Streaming SSR',
        description: 'Complete guide to React Server Components (RSC), Suspense boundaries, parallel routes, and instant streaming responses.',
        tags: ['react', 'frontend', 'javascript'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=640&q=80',
        durationSec: 890,
        viewCount: 9530,
        likeCount: 1140,
        publishedAt: new Date(now - 3 * 3600000),
      },
      {
        owner: maya._id,
        title: 'Building a Vector Search Engine from Scratch in Python',
        description: 'Learn how cosine similarity, HNSW (Hierarchical Navigable Small World) graphs, and vector embeddings power modern AI retrieval systems.',
        tags: ['algorithms', 'ai', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=640&q=80',
        durationSec: 1050,
        viewCount: 11200,
        likeCount: 1350,
        publishedAt: new Date(now - 2 * 3600000),
      },
      {
        owner: alex._id,
        title: 'GraphQL vs REST: Schema Federation at Scale',
        description: 'Architectural breakdown of Apollo Federation, n+1 dataloader batching, schema stitching, and caching strategies.',
        tags: ['node', 'system design', 'frontend'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=640&q=80',
        durationSec: 630,
        viewCount: 3480,
        likeCount: 360,
        publishedAt: new Date(now - 1 * 3600000),
      },
      {
        owner: sam._id,
        title: 'Zero Trust Cloud Security: IAM, mTLS, and Network Policies',
        description: 'Hardening multi-tenant Kubernetes clusters with Cilium network policies, SPIFFE/SPIRE workload identities, and automated mTLS.',
        tags: ['devops', 'system design', 'cloud'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=640&q=80',
        durationSec: 810,
        viewCount: 2980,
        likeCount: 310,
        publishedAt: new Date(now - 50 * 60000),
      },
      {
        owner: maya._id,
        title: 'Trie Data Structure & Autocomplete System Design',
        description: 'How Google and Amazon build real-time autocomplete suggestions: Trie implementations, ranking heuristics, and distributed caching.',
        tags: ['dsa', 'algorithms', 'system design'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=640&q=80',
        durationSec: 570,
        viewCount: 6740,
        likeCount: 720,
        publishedAt: new Date(now - 40 * 60000),
      },
      {
        owner: alex._id,
        title: 'CSS Container Queries & Modern Responsive Layouts',
        description: 'Stop using media queries! Learn how container queries, @container, :has(), and subgrid unlock truly modular component design.',
        tags: ['frontend', 'css', 'react'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=640&q=80',
        durationSec: 420,
        viewCount: 5120,
        likeCount: 590,
        publishedAt: new Date(now - 30 * 60000),
      },
      {
        owner: sam._id,
        title: 'MongoDB Sharding & Replica Sets Architecture',
        description: 'High-availability replica set election mechanics, chunk migrations across shards, and choosing the optimal shard key.',
        tags: ['databases', 'system design', 'devops'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=640&q=80',
        durationSec: 980,
        viewCount: 4310,
        likeCount: 480,
        publishedAt: new Date(now - 20 * 60000),
      },
      {
        owner: alex._id,
        title: 'How To Build a Real-Time Multiplayer Canvas in WebSockets',
        description: 'Building collaborative real-time whiteboards using HTML5 Canvas, CRDT conflict resolution, and WebSocket operational transforms.',
        tags: ['javascript', 'frontend', 'node'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=640&q=80',
        durationSec: 750,
        viewCount: 7890,
        likeCount: 840,
        publishedAt: new Date(now - 15 * 60000),
      },
      {
        owner: maya._id,
        title: 'Dynamic Programming: Knapsack & Coin Change Visualized',
        description: 'Visual step-by-step 2D matrix state breakdown of 0/1 Knapsack, Unbounded Knapsack, and optimal Coin Change subproblems.',
        tags: ['dsa', 'algorithms', 'coding'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=640&q=80',
        durationSec: 860,
        viewCount: 9120,
        likeCount: 990,
        publishedAt: new Date(now - 10 * 60000),
      },
      {
        owner: sam._id,
        title: 'CI/CD Pipeline with GitHub Actions and Docker BuildKit',
        description: 'Master GitHub Actions workflows: matrix builds, remote Docker layer caching with BuildKit, automated semver tagging, and staging rollouts.',
        tags: ['devops', 'node', 'cloud'],
        visibility: 'public',
        status: 'ready',
        hlsUrl: demoHlsStream,
        thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=640&q=80',
        durationSec: 690,
        viewCount: 3670,
        likeCount: 395,
        publishedAt: new Date(now - 5 * 60000),
      },
    ];

    const createdVideos = await Video.create(videosData);
    console.log(`[Seed] Successfully seeded 3 demo users and ${createdVideos.length} ready videos!`);

    console.log('[Seed] Seeding demo subscriptions...');
    await Subscription.create([
      { subscriber: maya._id, channel: alex._id },
      { subscriber: maya._id, channel: sam._id },
      { subscriber: alex._id, channel: maya._id },
      { subscriber: sam._id, channel: maya._id },
      { subscriber: sam._id, channel: alex._id },
    ]);

    console.log('[Seed] Seeding demo comments and timestamp links...');
    // Alex comments on Maya's first video (Binary Search Trees)
    const c1 = await Comment.create({
      video: createdVideos[0]._id,
      author: alex._id,
      body: 'Check out 2:15 for the AVL vs Red-Black rotation comparison! Super clear explanation.',
    });

    // Maya replies to Alex's comment
    await Comment.create({
      video: createdVideos[0]._id,
      author: maya._id,
      parent: c1._id,
      body: 'Thanks Alex! 2:15 is definitely where most people get tripped up on tree rotations.',
    });

    // Sam comments on Maya's first video
    await Comment.create({
      video: createdVideos[0]._id,
      author: sam._id,
      body: 'At 1:30 the recursion tree visualization made it click for me. Excellent job!',
    });

    // Maya comments on Alex's Tailwind CSS video (createdVideos[15])
    await Comment.create({
      video: createdVideos[15]._id,
      author: maya._id,
      body: 'The tip at 0:45 on container queries with Tailwind is gold. Using this in my new project.',
    });

    // Sam comments on Maya's Rust video (createdVideos[16])
    await Comment.create({
      video: createdVideos[16]._id,
      author: sam._id,
      body: 'See 3:20 for the memory layout comparison between V8 heap and Rust stack allocations!',
    });

    // Maya comments on Alex's Next.js 15 video (createdVideos[18])
    await Comment.create({
      video: createdVideos[18]._id,
      author: maya._id,
      body: 'The diagram at 1:15 explaining streaming SSR with Suspense is brilliant.',
    });

    // Alex comments on Maya's Trie video (createdVideos[21])
    await Comment.create({
      video: createdVideos[21]._id,
      author: alex._id,
      body: 'At 2:40 the prefix lookup algorithm was explained so cleanly.',
    });

    // Update video comment counts
    await Video.updateOne({ _id: createdVideos[0]._id }, { $set: { commentCount: 3 } });
    await Video.updateOne({ _id: createdVideos[15]._id }, { $set: { commentCount: 1 } });
    await Video.updateOne({ _id: createdVideos[16]._id }, { $set: { commentCount: 1 } });
    await Video.updateOne({ _id: createdVideos[18]._id }, { $set: { commentCount: 1 } });
    await Video.updateOne({ _id: createdVideos[21]._id }, { $set: { commentCount: 1 } });

    console.log('[Seed] Seeding demo reactions and watch progress...');
    await Reaction.create([
      { user: alex._id, video: createdVideos[0]._id, value: 1 },
      { user: sam._id, video: createdVideos[0]._id, value: 1 },
      { user: maya._id, video: createdVideos[15]._id, value: 1 },
      { user: alex._id, video: createdVideos[16]._id, value: 1 },
      { user: sam._id, video: createdVideos[18]._id, value: 1 },
      { user: maya._id, video: createdVideos[21]._id, value: 1 },
    ]);

    await WatchProgress.create([
      {
        user: maya._id,
        video: createdVideos[15]._id,
        positionSec: 180,
        durationSec: createdVideos[15].durationSec,
      },
      {
        user: alex._id,
        video: createdVideos[0]._id,
        positionSec: 135,
        durationSec: createdVideos[0].durationSec,
      },
    ]);

    console.log('[Seed] All demo data successfully seeded!');
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
