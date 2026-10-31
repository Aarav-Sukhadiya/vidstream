/**
 * Static demo content for the seed script.
 * Every stream URL below has been checked to serve a VOD playlist with CORS enabled;
 * `durationSec` matches the real stream length so the UI shows correct durations.
 */

const STREAMS = [
  { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', durationSec: 635 },
  { url: 'https://test-streams.mux.dev/tos_ismc/main.m3u8', durationSec: 734 },
  { url: 'https://test-streams.mux.dev/test_001/stream.m3u8', durationSec: 510 },
  {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    durationSec: 600,
  },
  {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    durationSec: 1800,
  },
  {
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    durationSec: 734,
  },
  { url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8', durationSec: 60 },
  {
    url: 'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8',
    durationSec: 372,
  },
];

const unsplash = (id, w = 640) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Verified tech-themed Unsplash images; remaining videos get a unique picsum image. */
const TECH_THUMBNAILS = [
  '1515879218367-8466d910aaa4',
  '1633356122544-f134324a6cee',
  '1558494949-ef010cbdcc31',
  '1507238691740-187a5b1d37b8',
  '1509228468518-180dd4864904',
  '1544383835-bda2bc66a55d',
  '1574717024653-61fd2cf4d44d',
  '1526374965328-7f61d4dc18c5',
  '1551288049-bebda4e38f71',
  '1555066931-4365d14bab8c',
  '1605379399642-870262d3d051',
  '1527474305487-b87b222841cc',
  '1504639725590-34d0984388bd',
  '1618005182384-a83a8bd57fbe',
  '1667372393119-3d4c48d07fc9',
  '1581291518857-4e27b48ff24e',
  '1555066931-bf19f8fd1085',
  '1517694712202-14dd9538aa97',
  '1620712943543-bcc4688e7485',
  '1522542550221-31fd19575a2d',
  '1563986768609-322da13575f3',
  '1579783900882-c0d3dad7b119',
  '1618401471353-b98afee0b2eb',
];

const USERS = [
  {
    key: 'maya',
    email: 'maya@vidstream.com',
    handle: 'maya',
    displayName: 'Maya Tech',
    bio: 'Full-stack engineer building distributed systems and teaching DSA.',
    avatarUrl: unsplash('1534528741775-53994a69daeb', 150),
    baseSubscribers: 1420,
  },
  {
    key: 'alex',
    email: 'alex@vidstream.com',
    handle: 'alex_dev',
    displayName: 'Alex Rivers',
    bio: 'Frontend architecture, modern CSS layouts, and UI performance.',
    avatarUrl: unsplash('1539571696357-5a69c17a67c6', 150),
    baseSubscribers: 890,
  },
  {
    key: 'sam',
    email: 'sam@vidstream.com',
    handle: 'sam_systems',
    displayName: 'Samira Khan',
    bio: 'DevOps, Kubernetes orchestration, and database scaling.',
    avatarUrl: unsplash('1517841905240-472988babdf9', 150),
    baseSubscribers: 2310,
  },
  {
    key: 'priya',
    email: 'priya@vidstream.com',
    handle: 'priya_ml',
    displayName: 'Priya Nair',
    bio: 'Machine learning engineer. Transformers, embeddings and practical MLOps.',
    avatarUrl: 'https://picsum.photos/seed/vidstream-priya/150/150',
    baseSubscribers: 3180,
  },
  {
    key: 'leo',
    email: 'leo@vidstream.com',
    handle: 'leo_gamedev',
    displayName: 'Leo Martins',
    bio: 'Indie game developer. Physics, shaders and devlogs every Friday.',
    avatarUrl: 'https://picsum.photos/seed/vidstream-leo/150/150',
    baseSubscribers: 1210,
  },
  {
    key: 'nina',
    email: 'nina@vidstream.com',
    handle: 'nina_designs',
    displayName: 'Nina Okafor',
    bio: 'Product designer teaching UI/UX, design systems and accessibility.',
    avatarUrl: 'https://picsum.photos/seed/vidstream-nina/150/150',
    baseSubscribers: 1760,
  },
  {
    key: 'omar',
    email: 'omar@vidstream.com',
    handle: 'omar_secure',
    displayName: 'Omar Haddad',
    bio: 'Application security, CTF walkthroughs and secure coding habits.',
    avatarUrl: 'https://picsum.photos/seed/vidstream-omar/150/150',
    baseSubscribers: 2040,
  },
  {
    key: 'jules',
    email: 'jules@vidstream.com',
    handle: 'jules_mobile',
    displayName: 'Jules Laurent',
    bio: 'Mobile developer shipping React Native and Swift apps to production.',
    avatarUrl: 'https://picsum.photos/seed/vidstream-jules/150/150',
    baseSubscribers: 960,
  },
];

// [owner key, title, description, tags]
const VIDEOS = [
  ['maya', 'Binary Search Trees in 10 Minutes', 'Complete walkthrough of binary search tree properties, tree traversals (inorder, preorder, postorder), and a worked insertion example.', ['dsa', 'algorithms', 'trees', 'coding']],
  ['alex', 'React 19 Server Actions & Optimistic Updates', 'Deep dive into React 19 server actions, useActionState, and managing instant UI rollbacks on mutation failure.', ['react', 'javascript', 'frontend']],
  ['sam', 'Designing Resilient Job Queues in MongoDB', 'How to build an atomic background worker queue with MongoDB findOneAndUpdate, exponential retry backoff, and lock timeouts.', ['node', 'databases', 'system design', 'devops']],
  ['alex', 'Mastering CSS Grid and Subgrid with Real Examples', 'Practical guide to building complex responsive magazine and dashboard layouts using modern CSS Grid and subgrid.', ['frontend', 'css', 'layout']],
  ['maya', 'Dynamic Programming: From Recursion to Memoization', 'Breaking down hard dynamic programming problems systematically with state transition diagrams and space optimization.', ['dsa', 'algorithms', 'coding']],
  ['sam', 'Zero-Downtime Database Migrations in Production', 'Best practices for schema migrations, expand-contract patterns, and rolling zero-downtime deployments.', ['databases', 'devops', 'system design']],
  ['maya', 'Building an End-to-End Video Transcoder in Node.js', 'Architecture breakdown of FFmpeg child process management, multi-bitrate HLS playlist composition, and thumbnail extraction.', ['node', 'ffmpeg', 'system design', 'coding']],
  ['sam', 'WebSockets vs Server-Sent Events vs Long Polling', 'Comprehensive comparison of real-time communication protocols for modern full-stack web applications.', ['node', 'system design', 'architecture']],
  ['maya', 'Distributed Caching Patterns with Redis', 'Cache-aside, write-through, and cache stampede prevention strategies for high-throughput microservices.', ['system design', 'databases', 'node']],
  ['alex', 'TypeScript Generics and Conditional Types Mastery', 'Master advanced TypeScript type-level programming: mapped types, template literal types, and inference with infer.', ['react', 'javascript', 'coding']],
  ['sam', 'Dockerizing Full-Stack Node and React Applications', 'Step-by-step guide to writing optimized multi-stage Dockerfiles, caching npm dependencies, and deploying with Docker Compose.', ['devops', 'node', 'react']],
  ['maya', 'Graph Algorithms: Dijkstra and Bellman-Ford Explained', 'Visual intuition and JavaScript implementations of shortest path algorithms on weighted directed graphs.', ['dsa', 'algorithms', 'graph']],
  ['sam', 'PostgreSQL Indexing: B-Trees vs GIN vs GiST', 'Understanding query planning, EXPLAIN ANALYZE, and when to use partial or expression-based indexes.', ['databases', 'system design', 'sql']],
  ['alex', 'Building Interactive 3D Web Graphics with Three.js', 'Get started with shaders, geometries, lighting, and performance-tuned animation loops in modern browsers.', ['frontend', 'javascript', 'graphics']],
  ['sam', 'Kubernetes Autoscaling: HPA and KEDA Deep Dive', 'Auto-scaling stateless and event-driven workloads based on CPU, memory, and custom queue depth metrics.', ['devops', 'kubernetes', 'system design']],
  ['alex', 'Tailwind CSS Tips for Production-Grade UI Design', 'Modern component composition, dark mode design tokens, micro-interactions, and accessibility best practices.', ['frontend', 'css', 'react']],
  ['maya', 'Rust for JavaScript Developers: Memory Safety Without GC', 'An intuitive bridge from JavaScript to Rust: borrowing, ownership rules, lifetimes, and why Rust produces fast WebAssembly.', ['rust', 'system design', 'coding']],
  ['sam', 'Designing an Event-Driven Architecture with Apache Kafka', 'Partitioning strategies, consumer groups, exactly-once semantics, and handling schema evolution in production message streams.', ['system design', 'devops', 'node']],
  ['alex', 'Next.js 15 App Router: Server Components & Streaming SSR', 'Complete guide to React Server Components, Suspense boundaries, parallel routes, and streaming responses.', ['react', 'frontend', 'javascript']],
  ['maya', 'Building a Vector Search Engine from Scratch', 'How cosine similarity, HNSW graphs, and vector embeddings power modern AI retrieval systems.', ['algorithms', 'ai', 'coding']],
  ['alex', 'GraphQL vs REST: Schema Federation at Scale', 'Architectural breakdown of Apollo Federation, n+1 dataloader batching, schema stitching, and caching strategies.', ['node', 'system design', 'frontend']],
  ['sam', 'Zero Trust Cloud Security: IAM, mTLS, and Network Policies', 'Hardening multi-tenant Kubernetes clusters with network policies, workload identities, and automated mTLS.', ['devops', 'system design', 'cloud']],
  ['maya', 'Trie Data Structure & Autocomplete System Design', 'How real-time autocomplete suggestions work: Trie implementations, ranking heuristics, and distributed caching.', ['dsa', 'algorithms', 'system design']],
  ['alex', 'CSS Container Queries & Modern Responsive Layouts', 'Learn how container queries, @container, :has(), and subgrid unlock truly modular component design.', ['frontend', 'css', 'react']],
  ['sam', 'MongoDB Sharding & Replica Sets Architecture', 'Replica set election mechanics, chunk migrations across shards, and choosing the optimal shard key.', ['databases', 'system design', 'devops']],
  ['alex', 'Build a Real-Time Multiplayer Canvas with WebSockets', 'Collaborative real-time whiteboards using HTML5 Canvas, CRDT conflict resolution, and WebSockets.', ['javascript', 'frontend', 'node']],
  ['maya', 'Dynamic Programming: Knapsack & Coin Change Visualized', 'Step-by-step 2D table breakdown of 0/1 Knapsack, Unbounded Knapsack, and optimal Coin Change subproblems.', ['dsa', 'algorithms', 'coding']],
  ['sam', 'CI/CD Pipeline with GitHub Actions and Docker BuildKit', 'Matrix builds, remote Docker layer caching with BuildKit, automated semver tagging, and staging rollouts.', ['devops', 'node', 'cloud']],

  ['priya', 'Transformers Explained Visually: Attention from Scratch', 'Build intuition for self-attention, multi-head attention and positional encodings with diagrams and a tiny NumPy implementation.', ['ai', 'machine learning', 'python']],
  ['priya', 'Fine-Tuning Small Language Models on a Laptop', 'LoRA and QLoRA in practice: dataset prep, training loops, evaluation and avoiding catastrophic forgetting.', ['ai', 'machine learning', 'python']],
  ['priya', 'Embeddings 101: Semantic Search in 15 Minutes', 'From sentence embeddings to a working semantic search API with cosine similarity and approximate nearest neighbours.', ['ai', 'algorithms', 'python']],
  ['priya', 'Retrieval-Augmented Generation: A Production Checklist', 'Chunking strategies, hybrid retrieval, re-ranking, citations and evaluating answer quality before you ship.', ['ai', 'system design', 'machine learning']],
  ['priya', 'Gradient Descent Without the Scary Math', 'Learning rates, momentum and Adam explained with interactive plots and plain-language analogies.', ['machine learning', 'algorithms', 'python']],
  ['priya', 'MLOps: Shipping Models with Docker and FastAPI', 'Package a model, serve it behind FastAPI, add health checks, and roll out new versions safely.', ['ai', 'devops', 'python']],
  ['priya', 'Evaluating LLM Apps: Metrics That Actually Matter', 'Golden datasets, LLM-as-judge pitfalls, regression suites and tracking quality across prompt changes.', ['ai', 'machine learning', 'coding']],

  ['leo', 'Writing a 2D Physics Engine in a Weekend', 'Rigid bodies, collision detection with SAT, impulse resolution and keeping the simulation stable.', ['gamedev', 'algorithms', 'graphics']],
  ['leo', 'Shader Basics: Make Water That Looks Real', 'Vertex displacement, normal maps, fresnel and foam: a beginner-friendly GLSL water shader.', ['gamedev', 'graphics', 'shaders']],
  ['leo', 'Procedural Terrain with Perlin Noise', 'Octaves, persistence and erosion tricks to generate believable landscapes in real time.', ['gamedev', 'algorithms', 'graphics']],
  ['leo', 'Entity Component Systems: Why Games Use ECS', 'Data-oriented design, cache-friendly loops and how ECS scales to thousands of entities.', ['gamedev', 'system design', 'coding']],
  ['leo', 'Devlog #12: Shipping My First Steam Demo', 'What went right, what broke at launch, wishlist numbers, and the marketing lessons I learned the hard way.', ['gamedev', 'devlog']],
  ['leo', 'Pathfinding in Games: A* and Navigation Meshes', 'From grid A* to navmeshes and steering behaviours, with live debugging visualisations.', ['gamedev', 'algorithms', 'dsa']],
  ['leo', 'Game Feel: Juice, Screen Shake and Hit Stop', 'Small details that make games satisfying: easing, particles, camera shake and audio feedback.', ['gamedev', 'design']],

  ['nina', 'Design Systems from Zero: Tokens, Components, Docs', 'Set up colour and spacing tokens, build core components, and document them so teams actually use them.', ['design', 'frontend', 'css']],
  ['nina', 'Accessible Color Contrast Without Boring Palettes', 'WCAG contrast rules, APCA, and building vibrant palettes that still pass accessibility checks.', ['design', 'accessibility', 'css']],
  ['nina', 'Figma Auto Layout Masterclass', 'Responsive components with auto layout, constraints, variants and component properties.', ['design', 'figma']],
  ['nina', 'UX Writing: Microcopy That Converts', 'Buttons, empty states, error messages and onboarding copy that reduce friction and support load.', ['design', 'ux']],
  ['nina', 'Designing Dark Mode the Right Way', 'Elevation, desaturated colours, contrast and testing dark themes across real devices.', ['design', 'frontend', 'css']],
  ['nina', 'Usability Testing on a Shoestring Budget', 'Recruiting participants, writing task scripts and synthesising findings in a single afternoon.', ['design', 'ux', 'research']],
  ['nina', 'Motion Design Principles for Interfaces', 'Duration, easing and choreography for UI animation that guides attention instead of distracting.', ['design', 'frontend', 'animation']],

  ['omar', 'OWASP Top 10 Explained with Real Exploits', 'Walk through injection, broken access control, SSRF and more with safe, reproducible lab examples.', ['security', 'web', 'coding']],
  ['omar', 'JWT Security: Common Mistakes and How to Fix Them', 'Algorithm confusion, missing expiry, token storage, refresh token rotation and reuse detection.', ['security', 'node', 'auth']],
  ['omar', 'CTF Walkthrough: Web Exploitation Challenges', 'Solving beginner-to-intermediate web CTF challenges step by step, with the reasoning behind each payload.', ['security', 'ctf', 'web']],
  ['omar', 'Secure Password Storage: bcrypt, scrypt and Argon2', 'Salting, work factors, peppering and migrating legacy hashes without forcing password resets.', ['security', 'auth', 'coding']],
  ['omar', 'Threat Modeling for Developers in 20 Minutes', 'STRIDE in practice: data flow diagrams, trust boundaries and turning threats into backlog items.', ['security', 'system design']],
  ['omar', 'Content Security Policy: Stop XSS at the Browser', 'Writing a strict CSP with nonces, reporting violations and rolling it out without breaking your app.', ['security', 'frontend', 'web']],
  ['omar', 'Rate Limiting and Abuse Prevention for APIs', 'Token buckets, sliding windows, per-user vs per-IP limits and handling credential stuffing.', ['security', 'node', 'system design']],

  ['jules', 'React Native in 2026: Is It Still Worth It?', 'The new architecture, Expo Router, performance trade-offs and when to go native instead.', ['mobile', 'react', 'javascript']],
  ['jules', 'SwiftUI Animations That Feel Native', 'Springs, matched geometry effects and phase animators for polished iOS interactions.', ['mobile', 'swift', 'animation']],
  ['jules', 'Offline-First Mobile Apps with Local Sync', 'Local databases, conflict resolution and background sync so your app works on a train.', ['mobile', 'databases', 'system design']],
  ['jules', 'Push Notifications Done Right', 'APNs and FCM setup, permission prompts that users accept, and measuring notification fatigue.', ['mobile', 'node', 'ux']],
  ['jules', 'Shipping to the App Store: A Survival Guide', 'Certificates, TestFlight, review guidelines, rejections and staged rollouts.', ['mobile', 'devops']],
  ['jules', 'Mobile Performance: Profiling Janky Lists', 'Finding dropped frames, virtualised lists, image caching and measuring startup time.', ['mobile', 'react', 'performance']],
];

// Comment templates; {t} is replaced with a timestamp inside the video
const COMMENT_TEMPLATES = [
  'The explanation at {t} finally made this click for me. Thank you!',
  'Bookmarking {t}, that diagram is gold.',
  'Could you do a follow-up going deeper on the part around {t}?',
  'I paused at {t} and tried it myself — worked first time.',
  'Great pacing. The example at {t} is exactly what I needed for my project.',
  'Tiny nitpick: the slide at {t} differs slightly from the code, but the idea is clear.',
  'This is the clearest video on the topic I have found so far.',
  'Watching this before my interview tomorrow. Wish me luck!',
  'The part at {t} saved me hours of debugging, seriously.',
  'Love the production quality. What tool do you use for the diagrams at {t}?',
  'Shared this with my whole team. The section at {t} sparked a great discussion.',
  'Would love to see this applied to a real production codebase.',
];

const REPLY_TEMPLATES = [
  'Same here! Rewatched it twice.',
  'Good catch, thanks for pointing that out.',
  'Agreed, a follow-up would be great.',
  'Thanks so much, glad it helped!',
  'Noted — adding it to my list for the next video.',
  'Good luck! You have got this.',
];

module.exports = { STREAMS, TECH_THUMBNAILS, USERS, VIDEOS, COMMENT_TEMPLATES, REPLY_TEMPLATES, unsplash };
