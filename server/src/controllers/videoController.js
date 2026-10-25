const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const Job = require('../models/Job');
const { generateSignedUploadParams } = require('../services/storage');
const { enqueueTranscodeJob } = require('../workers/queue');
const { TEMP_BASE } = require('../workers');
const { AppError } = require('../middleware/errorHandler');

async function createVideo(req, res, next) {
  try {
    const { title, description, tags, visibility } = req.body;

    // Create the Video record in 'awaiting_upload' status
    const video = await Video.create({
      owner: req.user._id,
      title,
      description: description || '',
      tags: tags || [],
      visibility: visibility || 'public',
      status: 'awaiting_upload',
    });

    // Generate signed upload parameters for Cloudinary direct upload
    const upload = generateSignedUploadParams(video._id.toString());

    res.status(201).json({
      video: {
        id: video._id.toString(),
        status: video.status,
      },
      upload,
    });
  } catch (err) {
    next(err);
  }
}

async function confirmVideoUpload(req, res, next) {
  try {
    const { id } = req.params;
    const { public_id, secure_url } = req.body;

    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: Not the video owner', 403, 'FORBIDDEN');
    }

    if (video.status === 'awaiting_upload') {
      video.status = 'queued';
      video.sourcePublicId = public_id || `vidstream/raw/${video._id}`;
      if (secure_url) {
        video.hlsUrl = secure_url;
      }
      await video.save();

      // Enqueue transcode job
      await enqueueTranscodeJob(video._id);

      // Emit real-time status update via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.emit('video:status', {
          videoId: video._id.toString(),
          status: 'queued',
        });
      }
    }

    res.status(200).json({
      video: {
        id: video._id.toString(),
        status: video.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List videos owned by authenticated user (Studio view)
 */
async function getMyVideos(req, res, next) {
  try {
    const videos = await Video.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const items = videos.map((v) => ({
      id: v._id.toString(),
      title: v.title,
      description: v.description,
      tags: v.tags,
      visibility: v.visibility,
      status: v.status,
      failureReason: v.failureReason,
      hlsUrl: v.hlsUrl,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      createdAt: v.createdAt,
      publishedAt: v.publishedAt,
    }));

    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Retry transcode for a failed video
 */
async function retryVideo(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);

    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: Not the video owner', 403, 'FORBIDDEN');
    }

    if (video.status !== 'failed') {
      throw new AppError('Only failed videos can be retried', 400, 'INVALID_STATE');
    }

    // Reset video status
    video.status = 'queued';
    video.failureReason = null;
    await video.save();

    // Recreate or reset Job to queued with 0 attempts
    await Job.findOneAndUpdate(
      { video: video._id },
      {
        $set: {
          status: 'queued',
          attempts: 0,
          runAfter: new Date(),
          lockedAt: null,
          lastError: null,
        },
      },
      { upsert: true, new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('video:status', {
        videoId: video._id.toString(),
        status: 'queued',
      });
    }

    res.status(200).json({
      video: {
        id: video._id.toString(),
        status: video.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Edit video metadata (title, description, tags, visibility)
 */
async function updateVideo(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, tags, visibility } = req.body;

    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: Not the video owner', 403, 'FORBIDDEN');
    }

    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (tags !== undefined) video.tags = tags;
    if (visibility !== undefined) video.visibility = visibility;

    await video.save();

    res.status(200).json({
      video: {
        id: video._id.toString(),
        title: video.title,
        description: video.description,
        tags: video.tags,
        visibility: video.visibility,
        status: video.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a video and cleanup associated jobs and local files
 */
async function deleteVideo(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);

    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: Not the video owner', 403, 'FORBIDDEN');
    }

    // Cleanup local files in temp directory if present
    const mediaDir = path.join(TEMP_BASE, video._id.toString());
    try {
      await fs.promises.rm(mediaDir, { recursive: true, force: true });
    } catch {
      // ignore file deletion errors
    }

    // Cleanup associated jobs
    await Job.deleteMany({ video: video._id });

    // Delete video record
    await Video.deleteOne({ _id: video._id });

    const io = req.app.get('io');
    if (io) {
      io.emit('video:deleted', { videoId: id });
    }

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
      id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createVideo,
  confirmVideoUpload,
  getMyVideos,
  retryVideo,
  updateVideo,
  deleteVideo,
};
