const { Job, claimNextJob, failJob, requeueStaleJobs, enqueueTranscodeJob, LOCK_TIMEOUT_MS } = require('../src/workers/queue');
const Video = require('../src/models/Video');
const User = require('../src/models/User');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Mongo-Backed Job Queue Suite (Checkpoint 8)', () => {
  let testUser;
  let testVideo;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: 'queue_worker_test@vidstream.com' });

    testUser = await User.create({
      email: 'queue_worker_test@vidstream.com',
      passwordHash: 'hash_placeholder_123',
      handle: 'queue_worker',
      displayName: 'Queue Worker',
    });
  });

  afterAll(async () => {
    await Job.deleteMany({});
    if (testUser) {
      await Video.deleteMany({ owner: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    await Job.deleteMany({});
    await Video.deleteMany({ owner: testUser._id });

    testVideo = await Video.create({
      owner: testUser._id,
      title: 'Queue Test Video',
      status: 'queued',
    });
  });

  it('Parallel claims: two or more concurrent claims never claim the same job', async () => {
    // Insert 1 job
    await Job.create({
      video: testVideo._id,
      status: 'queued',
      runAfter: new Date(Date.now() - 1000), // ready now
      attempts: 0,
    });

    // Run 10 simultaneous claims
    const claimPromises = Array.from({ length: 10 }, () => claimNextJob());
    const results = await Promise.all(claimPromises);

    const successfulClaims = results.filter((res) => res !== null);
    const failedClaims = results.filter((res) => res === null);

    expect(successfulClaims.length).toBe(1);
    expect(failedClaims.length).toBe(9);

    const claimed = successfulClaims[0];
    expect(claimed.status).toBe('running');
    expect(claimed.attempts).toBe(1);
    expect(claimed.lockedAt).toBeDefined();

    // In MongoDB, the job should now be running
    const jobInDb = await Job.findById(claimed._id);
    expect(jobInDb.status).toBe('running');
  });

  it('Stale requeue: a running job locked for over 15 minutes is requeued', async () => {
    const expiredLockTime = new Date(Date.now() - (LOCK_TIMEOUT_MS + 60000)); // 16 mins ago

    const staleJob = await Job.create({
      video: testVideo._id,
      status: 'running',
      lockedAt: expiredLockTime,
      attempts: 1,
      maxAttempts: 3,
    });

    await requeueStaleJobs();

    const updatedJob = await Job.findById(staleJob._id);
    expect(updatedJob.status).toBe('queued');
    expect(updatedJob.lastError).toBe('Processing timed out');
    expect(updatedJob.runAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('Three failures: a job failing 3 times marks the job and video as failed', async () => {
    const job = await Job.create({
      video: testVideo._id,
      status: 'running',
      attempts: 1,
      maxAttempts: 3,
    });

    // 1st failure: attempts (1) < maxAttempts (3) -> requeued with backoff
    await failJob(job, 'First transient error');
    let dbJob = await Job.findById(job._id);
    expect(dbJob.status).toBe('queued');
    expect(dbJob.lastError).toBe('First transient error');

    // Simulate claiming again (attempts becomes 2)
    dbJob.attempts = 2;
    dbJob.status = 'running';
    await dbJob.save();

    // 2nd failure: attempts (2) < maxAttempts (3) -> requeued with backoff
    await failJob(dbJob, 'Second transient error');
    dbJob = await Job.findById(job._id);
    expect(dbJob.status).toBe('queued');

    // Simulate claiming 3rd time (attempts becomes 3)
    dbJob.attempts = 3;
    dbJob.status = 'running';
    await dbJob.save();

    // 3rd failure: attempts (3) === maxAttempts (3) -> marked failed
    await failJob(dbJob, 'Fatal transcode failure: corrupted bitstream');
    dbJob = await Job.findById(job._id);
    expect(dbJob.status).toBe('failed');
    expect(dbJob.lastError).toBe('Fatal transcode failure: corrupted bitstream');

    // Verify video status is moved to 'failed' with failureReason
    const dbVideo = await Video.findById(testVideo._id);
    expect(dbVideo.status).toBe('failed');
    expect(dbVideo.failureReason).toBe('Fatal transcode failure: corrupted bitstream');
  });

  it('claimNextJob respects runAfter backoff and skips future jobs', async () => {
    // Create a job scheduled for 5 minutes in the future
    await Job.create({
      video: testVideo._id,
      status: 'queued',
      runAfter: new Date(Date.now() + 5 * 60 * 1000),
    });

    const claimed = await claimNextJob();
    expect(claimed).toBeNull();
  });

  it('enqueueTranscodeJob creates queued job idempotently', async () => {
    const job1 = await enqueueTranscodeJob(testVideo._id);
    expect(job1).toBeDefined();
    expect(job1.status).toBe('queued');

    // Calling enqueue again for same video does not create duplicate
    const job2 = await enqueueTranscodeJob(testVideo._id);
    expect(job2._id.toString()).toBe(job1._id.toString());

    const totalJobs = await Job.countDocuments({ video: testVideo._id });
    expect(totalJobs).toBe(1);
  });
});
