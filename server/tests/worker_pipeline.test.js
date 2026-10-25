const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const Video = require('../src/models/Video');
const User = require('../src/models/User');
const Job = require('../src/models/Job');
const { processJob, TEMP_BASE } = require('../src/workers');
const { enqueueTranscodeJob } = require('../src/workers/queue');
const { connectDB, disconnectDB } = require('../src/config/db');

const execFileAsync = promisify(execFile);
const testPipelineDir = path.join(os.tmpdir(), `pipeline_test_${Date.now()}`);
const sampleMp4Path = path.join(testPipelineDir, 'worker_sample.mp4');

describe('End-to-End Transcode Pipeline Suite (Checkpoint 10)', () => {
  let testUser;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: 'pipeline_tester@vidstream.com' });

    testUser = await User.create({
      email: 'pipeline_tester@vidstream.com',
      passwordHash: 'dummy_hash',
      handle: 'pipeline_tester',
      displayName: 'Pipeline Tester',
    });

    await fs.promises.mkdir(testPipelineDir, { recursive: true });

    // Generate a quick 3-second test clip
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'testsrc=duration=3:size=640x360:rate=30',
      '-c:v', 'libx264',
      sampleMp4Path,
    ]);
  }, 20000);

  afterAll(async () => {
    if (testUser) {
      await Video.deleteMany({ owner: testUser._id });
      await Job.deleteMany({});
      await User.deleteOne({ _id: testUser._id });
    }
    try {
      await fs.promises.rm(testPipelineDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    await disconnectDB();
  });

  it('Valid upload reaches ready: worker produces HLS, thumbnail, and marks video ready', async () => {
    const video = await Video.create({
      owner: testUser._id,
      title: 'Valid Pipeline Video',
      status: 'queued',
      sourcePublicId: sampleMp4Path,
    });

    // Place source video into the expected temp directory
    const workDir = path.join(TEMP_BASE, video._id.toString());
    await fs.promises.mkdir(workDir, { recursive: true });
    await fs.promises.copyFile(sampleMp4Path, path.join(workDir, 'source.mp4'));

    const job = await enqueueTranscodeJob(video._id);

    // Process job
    const result = await processJob(job, null);
    expect(result.success).toBe(true);

    // Verify video in MongoDB is ready
    const readyVideo = await Video.findById(video._id);
    expect(readyVideo.status).toBe('ready');
    expect(readyVideo.hlsUrl).toContain('master.m3u8');
    expect(readyVideo.thumbnailUrl).toContain('thumb.jpg');
    expect(readyVideo.durationSec).toBeGreaterThanOrEqual(2);
    expect(readyVideo.publishedAt).toBeDefined();

    // Verify job in MongoDB is done
    const doneJob = await Job.findById(job._id);
    expect(doneJob.status).toBe('done');

    // Clean up temp dir
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }, 25000);

  it('A text file renamed to .mp4 reaches failed with a readable reason', async () => {
    const badVideo = await Video.create({
      owner: testUser._id,
      title: 'Corrupt Text Video',
      status: 'queued',
    });

    // Create a bad source file (text file with .mp4 extension)
    const workDir = path.join(TEMP_BASE, badVideo._id.toString());
    await fs.promises.mkdir(workDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(workDir, 'source.mp4'),
      'Plain text file maliciously disguised as an MP4 container'
    );

    // Create job with attempts set to maxAttempts (3) so failure triggers terminal state
    const job = await Job.create({
      video: badVideo._id,
      status: 'running',
      attempts: 3,
      maxAttempts: 3,
    });

    const result = await processJob(job, null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unreadable container|corrupt media/i);

    // Verify video status is failed with failureReason recorded
    const failedVideo = await Video.findById(badVideo._id);
    expect(failedVideo.status).toBe('failed');
    expect(failedVideo.failureReason).toMatch(/unreadable container|corrupt media/i);

    // Verify job status is failed
    const failedJob = await Job.findById(job._id);
    expect(failedJob.status).toBe('failed');
    expect(failedJob.lastError).toMatch(/unreadable container|corrupt media/i);

    // Clean up temp dir
    await fs.promises.rm(workDir, { recursive: true, force: true });
  });
});
