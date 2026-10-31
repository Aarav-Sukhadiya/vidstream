const Job = require('../models/Job');
const Video = require('../models/Video');

const LOCK_TIMEOUT_MS = 15 * 60 * 1000;

async function claimNextJob() {
  return Job.findOneAndUpdate(
    { status: 'queued', runAfter: { $lte: new Date() } },
    { $set: { status: 'running', lockedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { runAfter: 1 }, new: true }
  );
}

async function failJob(job, reason) {
  if (job.attempts < job.maxAttempts) {
    const delayMs = 30000 * 2 ** job.attempts;
    await Job.updateOne(
      { _id: job._id },
      { $set: { status: 'queued', runAfter: new Date(Date.now() + delayMs), lastError: reason } }
    );
    // Video waits for the retry in the queue rather than appearing stuck in "processing"
    await Video.updateOne({ _id: job.video, status: 'processing' }, { $set: { status: 'queued' } });
    return;
  }
  await Job.updateOne({ _id: job._id }, { $set: { status: 'failed', lastError: reason } });
  await Video.updateOne({ _id: job.video }, { $set: { status: 'failed', failureReason: reason } });
}

async function requeueStaleJobs() {
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const stale = await Job.find({ status: 'running', lockedAt: { $lt: cutoff } }).lean();
  for (const job of stale) {
    await failJob(job, 'Processing timed out');
  }
}

async function enqueueTranscodeJob(videoId) {
  // Reuse an active job for this video if one exists
  const existing = await Job.findOne({ video: videoId, status: { $in: ['queued', 'running'] } });
  if (existing) return existing;

  return Job.create({ video: videoId, status: 'queued', runAfter: new Date() });
}

module.exports = {
  Job,
  claimNextJob,
  failJob,
  requeueStaleJobs,
  enqueueTranscodeJob,
  LOCK_TIMEOUT_MS,
};
