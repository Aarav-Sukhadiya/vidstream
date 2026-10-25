const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const { claimNextJob, failJob, requeueStaleJobs } = require('./queue');
const { probeVideo, transcodeToHLS } = require('./transcoder');

let isRunning = false;
let workerInterval = null;

const TEMP_BASE = path.join(__dirname, '../../temp');

/**
 * Process a single transcode job end-to-end
 */
async function processJob(job, io) {
  const videoId = job.video.toString();
  const workDir = path.join(TEMP_BASE, videoId);

  try {
    // 1. Mark video as processing and notify clients
    await Video.updateOne({ _id: job.video }, { $set: { status: 'processing' } });
    if (io) {
      io.emit('video:status', { videoId, status: 'processing' });
    }

    const video = await Video.findById(job.video);
    if (!video) {
      throw new Error(`Video ${videoId} no longer exists`);
    }

    await fs.promises.mkdir(workDir, { recursive: true });

    // 2. Resolve source video file
    // Check if source file is stored locally in workDir/source.mp4 or resolve mock/local source
    let sourcePath = path.join(workDir, 'source.mp4');
    if (!fs.existsSync(sourcePath)) {
      // If a source path was saved or mock cloud in development, check fixture or write test input
      if (video.sourcePublicId && fs.existsSync(video.sourcePublicId)) {
        sourcePath = video.sourcePublicId;
      } else {
        throw new Error('Video source file not found or could not be downloaded');
      }
    }

    // 3. Probe video container, streams, and duration
    const metadata = await probeVideo(sourcePath);

    // 4. Transcode to multi-rendition HLS & thumbnail
    const outDir = path.join(workDir, 'hls');
    await transcodeToHLS(sourcePath, outDir, metadata);

    // 5. Build public URLs
    // Local / development URL: /media/:videoId/hls/master.m3u8 & /media/:videoId/hls/thumb.jpg
    const hlsUrl = `/media/${videoId}/hls/master.m3u8`;
    const thumbnailUrl = `/media/${videoId}/hls/thumb.jpg`;

    // 6. Update Video to ready
    video.status = 'ready';
    video.hlsUrl = hlsUrl;
    video.thumbnailUrl = thumbnailUrl;
    video.durationSec = Math.round(metadata.durationSec);
    video.publishedAt = new Date();
    await video.save();

    // 7. Mark Job as done
    job.status = 'done';
    await job.save();

    // 8. Emit ready status to Socket.IO clients
    if (io) {
      io.emit('video:status', {
        videoId,
        status: 'ready',
        hlsUrl,
        thumbnailUrl,
        durationSec: video.durationSec,
      });
    }

    console.log(`[Worker] Transcode complete for video ${videoId} (ready)`);
    return { success: true, video };
  } catch (err) {
    console.error(`[Worker] Transcode failed for video ${videoId}: ${err.message}`);

    // Call failJob to handle backoff / terminal failure
    await failJob(job, err.message);

    // If job attempts reached max, emit failed status immediately
    if (job.attempts >= job.maxAttempts) {
      if (io) {
        io.emit('video:status', {
          videoId,
          status: 'failed',
          failureReason: err.message,
        });
      }
    }

    return { success: false, error: err.message };
  }
}

/**
 * Worker polling loop
 */
async function tick(io) {
  if (isRunning) return;
  isRunning = true;

  try {
    await requeueStaleJobs();
    const job = await claimNextJob();
    if (job) {
      await processJob(job, io);
    }
  } catch (err) {
    console.error('[Worker] Error during worker tick:', err.message);
  } finally {
    isRunning = false;
  }
}

function startWorkerLoop(io, intervalMs = 3000) {
  if (process.env.WORKER_MODE === 'disabled') {
    console.log('[Worker] Worker loop disabled by WORKER_MODE=disabled');
    return;
  }

  console.log('[Worker] Starting transcode worker loop (every 3s)');
  workerInterval = setInterval(() => tick(io), intervalMs);
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
  TEMP_BASE,
};
