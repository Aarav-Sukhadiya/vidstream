const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Video = require('../models/Video');
const Job = require('../models/Job');
const ViewEvent = require('../models/ViewEvent');
const WatchProgress = require('../models/WatchProgress');
const Reaction = require('../models/Reaction');
const Subscription = require('../models/Subscription');
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

/**
 * Get video by ID with visibility rules and viewer context
 */
async function getVideoById(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id).populate('owner', 'handle displayName avatarUrl subscriberCount');

    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    const currentUserId = req.user?._id?.toString();
    const isOwner = currentUserId && currentUserId === video.owner._id.toString();

    // Visibility enforcement:
    // 1. Private videos return 404 to everyone except the owner
    if (video.visibility === 'private' && !isOwner) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    // 2. Videos that are not ready are visible only to the owner; everyone else gets 404
    if (video.status !== 'ready' && !isOwner) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    const videoObj = {
      id: video._id.toString(),
      title: video.title,
      description: video.description,
      tags: video.tags,
      visibility: video.visibility,
      status: video.status,
      failureReason: video.failureReason,
      hlsUrl: video.hlsUrl,
      thumbnailUrl: video.thumbnailUrl,
      durationSec: video.durationSec,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      dislikeCount: video.dislikeCount,
      commentCount: video.commentCount,
      publishedAt: video.publishedAt,
      createdAt: video.createdAt,
      channel: {
        id: video.owner._id.toString(),
        handle: video.owner.handle,
        displayName: video.owner.displayName,
        avatarUrl: video.owner.avatarUrl,
        subscriberCount: video.owner.subscriberCount || 0,
      },
    };

    // Attach viewer progress, reaction, and subscription if authenticated
    if (req.user) {
      const [progress, reaction, subscription] = await Promise.all([
        WatchProgress.findOne({ user: req.user._id, video: video._id }),
        Reaction.findOne({ user: req.user._id, video: video._id }),
        Subscription.findOne({ subscriber: req.user._id, channel: video.owner._id }),
      ]);

      videoObj.viewer = {
        progressSec: progress ? progress.positionSec : 0,
        reaction: reaction ? reaction.value : 0,
        subscribed: !!subscription,
        isOwner,
      };
    }

    res.status(200).json({ video: videoObj });
  } catch (err) {
    next(err);
  }
}

/**
 * Deduplicated view recording
 */
async function recordView(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);

    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    let viewerKey;
    if (req.user) {
      viewerKey = req.user._id.toString();
    } else {
      const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';
      const salt = process.env.VIEW_SALT || 'vidstream_view_salt_2026';
      viewerKey = crypto.createHash('sha256').update(`${ip}-${userAgent}-${salt}`).digest('hex');
    }

    let counted = false;
    try {
      await ViewEvent.create({
        video: video._id,
        viewerKey,
      });
      // Increment view counter atomically
      await Video.updateOne({ _id: video._id }, { $inc: { viewCount: 1 } });
      counted = true;
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
      // Duplicate view key: view already counted in last 24h
    }

    res.status(200).json({ success: true, counted });
  } catch (err) {
    next(err);
  }
}

/**
 * Save playback position
 */
async function saveProgress(req, res, next) {
  try {
    const { id } = req.params;
    const { positionSec, durationSec } = req.body;

    if (positionSec === undefined || isNaN(positionSec)) {
      throw new AppError('Valid positionSec is required', 400, 'VALIDATION');
    }

    await WatchProgress.findOneAndUpdate(
      { user: req.user._id, video: id },
      {
        $set: {
          positionSec: Math.max(0, Math.round(positionSec)),
          durationSec: durationSec ? Math.round(durationSec) : 0,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, positionSec: Math.round(positionSec) });
  } catch (err) {
    next(err);
  }
}

/**
 * List public ready videos with cursor pagination (Home Feed & Search)
 */
async function getVideos(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const { cursor, tag, q, sort } = req.query;

    const query = {
      status: 'ready',
      visibility: 'public',
    };

    if (tag && tag.toLowerCase().trim() !== 'all') {
      query.tags = tag.toLowerCase().trim();
    }

    const effectiveSort = sort || (q && q.trim() ? 'relevance' : 'newest');

    let projection = {};
    if (q && q.trim()) {
      query.$text = { $search: q.trim() };
      if (effectiveSort === 'relevance') {
        projection = { score: { $meta: 'textScore' } };
      }
    }

    // Apply cursor pagination
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (effectiveSort === 'views' && decoded.viewCount !== undefined) {
          query.$or = [
            { viewCount: { $lt: decoded.viewCount } },
            { viewCount: decoded.viewCount, _id: { $lt: decoded.id } },
          ];
        } else if (decoded.publishedAt) {
          const cursorDate = new Date(decoded.publishedAt);
          query.$or = [
            { publishedAt: { $lt: cursorDate } },
            { publishedAt: cursorDate, _id: { $lt: decoded.id } },
          ];
        }
      } catch {
        // Invalid cursor ignored
      }
    }

    let sortOption = { publishedAt: -1, _id: -1 };
    if (effectiveSort === 'views') {
      sortOption = { viewCount: -1, _id: -1 };
    } else if (q && q.trim() && effectiveSort === 'relevance') {
      sortOption = { score: { $meta: 'textScore' }, _id: -1 };
    }

    const videos = await Video.find(query, projection)
      .sort(sortOption)
      .limit(limit + 1)
      .populate('owner', 'handle displayName avatarUrl')
      .lean();

    const hasMore = videos.length > limit;
    const items = hasMore ? videos.slice(0, limit) : videos;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorPayload = {
        id: lastItem._id.toString(),
        publishedAt: lastItem.publishedAt || lastItem.createdAt,
        viewCount: lastItem.viewCount || 0,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64url');
    }

    const formattedItems = items.map((v) => ({
      id: v._id.toString(),
      title: v.title,
      description: v.description,
      tags: v.tags,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount,
      publishedAt: v.publishedAt || v.createdAt,
      channel: {
        id: v.owner ? v.owner._id.toString() : '',
        handle: v.owner?.handle || 'creator',
        displayName: v.owner?.displayName || 'Creator',
        avatarUrl: v.owner?.avatarUrl || '',
      },
    }));

    res.status(200).json({
      items: formattedItems,
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get related videos sharing tags, strictly excluding the current video
 */
async function getRelatedVideos(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);

    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    const currentUserId = req.user?._id?.toString();
    const isOwner = currentUserId && currentUserId === video.owner.toString();

    // Visibility rules: non-owners cannot see private or non-ready videos
    if (video.visibility === 'private' && !isOwner) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }
    if (video.status !== 'ready' && !isOwner) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 20);

    let relatedVideos = [];

    // If video has tags, first find public ready videos sharing at least one tag
    if (video.tags && video.tags.length > 0) {
      relatedVideos = await Video.find({
        _id: { $ne: video._id },
        status: 'ready',
        visibility: 'public',
        tags: { $in: video.tags },
      })
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(limit)
        .populate('owner', 'handle displayName avatarUrl')
        .lean();
    }

    // Backfill with newest public ready videos if fewer than limit
    if (relatedVideos.length < limit) {
      const existingIds = [video._id, ...relatedVideos.map((v) => v._id)];
      const backfill = await Video.find({
        _id: { $nin: existingIds },
        status: 'ready',
        visibility: 'public',
      })
        .sort({ publishedAt: -1, _id: -1 })
        .limit(limit - relatedVideos.length)
        .populate('owner', 'handle displayName avatarUrl')
        .lean();

      relatedVideos = [...relatedVideos, ...backfill];
    }

    const formattedItems = relatedVideos.map((v) => ({
      id: v._id.toString(),
      title: v.title,
      description: v.description,
      tags: v.tags,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount,
      publishedAt: v.publishedAt || v.createdAt,
      channel: {
        id: v.owner ? v.owner._id.toString() : '',
        handle: v.owner?.handle || 'creator',
        displayName: v.owner?.displayName || 'Creator',
        avatarUrl: v.owner?.avatarUrl || '',
      },
    }));

    res.status(200).json({ items: formattedItems });
  } catch (err) {
    next(err);
  }
}

/**
 * Set or toggle like / dislike reaction on a video
 */
async function setReaction(req, res, next) {
  try {
    const { id } = req.params;
    const { value } = req.body; // 1 = like, -1 = dislike, 0 = clear

    if (![1, -1, 0].includes(value)) {
      throw new AppError('Reaction value must be 1, -1, or 0', 400, 'VALIDATION');
    }

    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    const existing = await Reaction.findOne({ user: req.user._id, video: id });

    if (value === 0) {
      // Clear reaction
      if (existing) {
        if (existing.value === 1) {
          await Video.updateOne({ _id: id }, { $inc: { likeCount: -1 } });
        } else if (existing.value === -1) {
          await Video.updateOne({ _id: id }, { $inc: { dislikeCount: -1 } });
        }
        await Reaction.deleteOne({ _id: existing._id });
      }
    } else if (value === 1) {
      // Like
      if (!existing) {
        try {
          await Reaction.create({ user: req.user._id, video: id, value: 1 });
          await Video.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      } else if (existing.value === -1) {
        existing.value = 1;
        await existing.save();
        await Video.updateOne({ _id: id }, { $inc: { likeCount: 1, dislikeCount: -1 } });
      }
      // If already liked (existing.value === 1), idempotent no-op
    } else if (value === -1) {
      // Dislike
      if (!existing) {
        try {
          await Reaction.create({ user: req.user._id, video: id, value: -1 });
          await Video.updateOne({ _id: id }, { $inc: { dislikeCount: 1 } });
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      } else if (existing.value === 1) {
        existing.value = -1;
        await existing.save();
        await Video.updateOne({ _id: id }, { $inc: { dislikeCount: 1, likeCount: -1 } });
      }
      // If already disliked (existing.value === -1), idempotent no-op
    }

    const updatedVideo = await Video.findById(id).select('likeCount dislikeCount');

    res.status(200).json({
      success: true,
      userReaction: value,
      likeCount: Math.max(0, updatedVideo.likeCount || 0),
      dislikeCount: Math.max(0, updatedVideo.dislikeCount || 0),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getVideos,
  getRelatedVideos,
  createVideo,
  confirmVideoUpload,
  getMyVideos,
  getVideoById,
  recordView,
  saveProgress,
  setReaction,
  retryVideo,
  updateVideo,
  deleteVideo,
};
