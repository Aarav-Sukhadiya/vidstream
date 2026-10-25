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
    return;
  }
  await Job.updateOne({ _id: job._id }, { $set: { status: 'failed', lastError: reason } });
  await Video.updateOne({ _id: job.video }, { $set: { status: 'failed', failureReason: reason } });
}

async function requeueStaleJobs() {
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const stale = await Job.find({ status: 'running', lockedAt: { $lt: cutoff } });
  for (const job of stale) {
    await failJob(job, 'Processing timed out');
  }
}

async function enqueueTranscodeJob(videoId) {
  // Check if active job exists
  let job = await Job.findOne({
    video: videoId,
    status: { $in: ['queued', 'running'] },
  });

  if (!job) {
    job = await Job.create({
      video: videoId,
      status: 'queued',
      runAfter: new Date(),
    });
  }

  return job;
}

module.exports = {
  Job,
  claimNextJob,
  failJob,
  requeueStaleJobs,
  enqueueTranscodeJob,
  LOCK_TIMEOUT_MS,
};
