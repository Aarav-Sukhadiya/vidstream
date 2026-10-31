const fs = require('fs');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const Video = require('../models/Video');
const Job = require('../models/Job');
const { claimNextJob, failJob, requeueStaleJobs } = require('./queue');
const { probeVideo, transcodeToHLS } = require('./transcoder');
const { TEMP_BASE } = require('./paths');
const { emitVideoStatus } = require('../realtime');
const { buildSourceUrl, isCloudinaryConfigured } = require('../services/storage');

const POLL_INTERVAL_MS = 3000;

let isRunning = false;
let workerInterval = null;

function maxSourceBytes() {
  const maxMb = parseFloat(process.env.MAX_UPLOAD_MB) || 100;
  // small allowance for container overhead vs. the size the client reported
  return Math.ceil(maxMb * 1024 * 1024 * 1.05);
}

/**
 * Stream a remote file to disk, aborting if it grows beyond the upload limit.
 */
async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download source video (HTTP ${res.status})`);
  }

  const limit = maxSourceBytes();
  let received = 0;
  const sizeGuard = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (received > limit) cb(new Error('Source video exceeds the maximum upload size'));
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(res.body), sizeGuard, fs.createWriteStream(dest));
  } catch (err) {
    await fs.promises.rm(dest, { force: true });
    throw err;
  }
}

/**
 * Work out where the source media lives and make sure it is on local disk.
 * Returns { sourcePath, downloaded } where `downloaded` means it is a temp copy.
 */
async function resolveSource(video, workDir) {
  // Pre-staged local source (manual/dev uploads)
  const staged = path.join(workDir, 'source.mp4');
  if (fs.existsSync(staged)) return { sourcePath: staged, downloaded: false };

  const localCopy = path.join(workDir, 'source');

  // Local file path (development fixtures / tests)
  if (video.sourcePublicId && path.isAbsolute(video.sourcePublicId)) {
    if (fs.existsSync(video.sourcePublicId)) {
      return { sourcePath: video.sourcePublicId, downloaded: false };
    }
    throw new Error('Video source file not found');
  }

  const url =
    video.sourceUrl ||
    (video.sourcePublicId && isCloudinaryConfigured() ? buildSourceUrl(video.sourcePublicId) : null);
  if (!url) {
    throw new Error('Video source file not found or could not be downloaded');
  }

  await downloadToFile(url, localCopy);
  return { sourcePath: localCopy, downloaded: true };
}

/**
 * Process a single transcode job end-to-end
 */
async function processJob(job) {
  const videoId = job.video.toString();
  const workDir = path.join(TEMP_BASE, videoId);
  let ownerId = null;
  let source = null;

  try {
    const video = await Video.findByIdAndUpdate(
      job.video,
      { $set: { status: 'processing' } },
      { new: true }
    );
    if (!video) {
      // Video was deleted: nothing to retry
      await Job.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', lastError: 'Video no longer exists' } }
      );
      return { success: false, error: 'Video no longer exists' };
    }
    ownerId = video.owner;
    emitVideoStatus(ownerId, { videoId, status: 'processing' });

    await fs.promises.mkdir(workDir, { recursive: true });

    source = await resolveSource(video, workDir);
    const metadata = await probeVideo(source.sourcePath);

    const outDir = path.join(workDir, 'hls');
    await fs.promises.rm(outDir, { recursive: true, force: true });
    await transcodeToHLS(source.sourcePath, outDir, metadata);

    const hlsUrl = `/media/${videoId}/hls/master.m3u8`;
    const thumbnailUrl = `/media/${videoId}/hls/thumb.jpg`;
    const durationSec = Math.round(metadata.durationSec);

    await Video.updateOne(
      { _id: video._id },
      {
        $set: {
          status: 'ready',
          hlsUrl,
          thumbnailUrl,
          durationSec,
          failureReason: null,
          publishedAt: video.publishedAt || new Date(),
        },
      }
    );
    await Job.updateOne({ _id: job._id }, { $set: { status: 'done', lastError: null } });

    emitVideoStatus(ownerId, { videoId, status: 'ready', hlsUrl, thumbnailUrl, durationSec });
    console.log(`[Worker] Transcode complete for video ${videoId}`);
    return { success: true, video: await Video.findById(video._id) };
  } catch (err) {
    console.error(`[Worker] Transcode failed for video ${videoId}: ${err.message}`);
    await failJob(job, err.message);

    if (job.attempts >= job.maxAttempts) {
      emitVideoStatus(ownerId, { videoId, status: 'failed', failureReason: err.message });
    }
    return { success: false, error: err.message };
  } finally {
    // Remove the downloaded raw source once the attempt is over; HLS output stays
    if (source?.downloaded) {
      await fs.promises.rm(source.sourcePath, { force: true }).catch(() => {});
    }
  }
}

/**
 * Worker polling loop
 */
async function tick() {
  if (isRunning) return;
  isRunning = true;

  try {
    await requeueStaleJobs();
    const job = await claimNextJob();
    if (job) await processJob(job);
  } catch (err) {
    console.error('[Worker] Error during worker tick:', err.message);
  } finally {
    isRunning = false;
  }
}

function startWorkerLoop(intervalMs = POLL_INTERVAL_MS) {
  if (process.env.WORKER_MODE === 'disabled' || workerInterval) return;

  console.log(`[Worker] Starting transcode worker loop (every ${intervalMs / 1000}s)`);
  workerInterval = setInterval(tick, intervalMs);
}

function stopWorkerLoop() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Worker] Stopped transcode worker loop');
  }
}

module.exports = {
  processJob,
  tick,
  startWorkerLoop,
  stopWorkerLoop,
  downloadToFile,
  TEMP_BASE,
};
