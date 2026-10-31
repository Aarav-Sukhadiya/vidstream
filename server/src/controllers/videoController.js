const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Video = require('../models/Video');
const Job = require('../models/Job');
const Comment = require('../models/Comment');
const ViewEvent = require('../models/ViewEvent');
const WatchProgress = require('../models/WatchProgress');
const Reaction = require('../models/Reaction');
const Subscription = require('../models/Subscription');
const {
  generateSignedUploadParams,
  getRawFolder,
  isTrustedSourceUrl,
  deleteSourceAsset,
} = require('../services/storage');
const { enqueueTranscodeJob } = require('../workers/queue');
const { TEMP_BASE } = require('../workers/paths');
const { emitVideoStatus, emitToUser } = require('../realtime');
const { AppError } = require('../middleware/errorHandler');
const { assertCanView, assertOwner, isVideoOwner } = require('../utils/access');
const {
  OWNER_CARD_FIELDS,
  toVideoCard,
  encodeCursor,
  decodeCursor,
  parseLimit,
  queryString,
} = require('../utils/serializers');

/**
 * Move a video from awaiting_upload to queued and enqueue its transcode job.
 * Shared by the client confirm endpoint and the Cloudinary webhook.
 */
async function markUploaded(video, { publicId, secureUrl }) {
  if (video.status !== 'awaiting_upload') return video;

  video.status = 'queued';
  video.sourcePublicId = publicId || video.sourcePublicId;
  if (secureUrl && isTrustedSourceUrl(secureUrl)) {
    video.sourceUrl = secureUrl;
  }
  await video.save();
  await enqueueTranscodeJob(video._id);

  emitVideoStatus(video.owner, { videoId: video._id.toString(), status: 'queued' });
  return video;
}

/** The uploaded asset must be the one we signed for this video. */
function isPublicIdForVideo(publicId, videoId) {
  return publicId === videoId || publicId.endsWith(`/${videoId}`);
}

async function createVideo(req, res, next) {
  try {
    const { title, description, tags, visibility } = req.body;

    const video = await Video.create({
      owner: req.user._id,
      title,
      description,
      tags,
      visibility,
      status: 'awaiting_upload',
    });

    res.status(201).json({
      video: { id: video._id.toString(), status: video.status },
      upload: generateSignedUploadParams(video._id.toString()),
    });
  } catch (err) {
    next(err);
  }
}

async function confirmVideoUpload(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);
    assertOwner(video, req.user);

    const publicId = req.body.public_id;
    if (publicId && !isPublicIdForVideo(publicId, id)) {
      throw new AppError('public_id does not belong to this video', 400, 'VALIDATION');
    }

    await markUploaded(video, {
      publicId: publicId || `${getRawFolder()}/${video._id}`,
      secureUrl: req.body.secure_url,
    });

    res.status(200).json({ video: { id: video._id.toString(), status: video.status } });
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
      .select('-sourcePublicId -sourceUrl -thumbnailPublicId')
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
    const video = await Video.findById(req.params.id);
    assertOwner(video, req.user);

    if (video.status !== 'failed') {
      throw new AppError('Only failed videos can be retried', 400, 'INVALID_STATE');
    }

    video.status = 'queued';
    video.failureReason = null;
    await video.save();

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

    emitVideoStatus(video.owner, { videoId: video._id.toString(), status: 'queued' });

    res.status(200).json({ video: { id: video._id.toString(), status: video.status } });
  } catch (err) {
    next(err);
  }
}

/**
 * Edit video metadata (title, description, tags, visibility)
 */
async function updateVideo(req, res, next) {
  try {
    const video = await Video.findById(req.params.id);
    assertOwner(video, req.user);

    for (const key of ['title', 'description', 'tags', 'visibility']) {
      if (req.body[key] !== undefined) video[key] = req.body[key];
    }
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
 * Delete a video and everything that references it
 */
async function deleteVideo(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);
    assertOwner(video, req.user);

    await Promise.all([
      fs.promises.rm(path.join(TEMP_BASE, id), { recursive: true, force: true }).catch(() => {}),
      Job.deleteMany({ video: video._id }),
      Comment.deleteMany({ video: video._id }),
      Reaction.deleteMany({ video: video._id }),
      WatchProgress.deleteMany({ video: video._id }),
      ViewEvent.deleteMany({ video: video._id }),
    ]);
    await Video.deleteOne({ _id: video._id });

    // Remove the raw upload from Cloudinary in the background; failure is non-fatal
    if (video.sourcePublicId && !path.isAbsolute(video.sourcePublicId)) {
      deleteSourceAsset(video.sourcePublicId).catch((err) =>
        console.warn(`[Storage] Failed to delete asset ${video.sourcePublicId}: ${err.message}`)
      );
    }

    emitToUser(video.owner, 'video:deleted', { videoId: id });

    res.status(200).json({ success: true, message: 'Video deleted successfully', id });
  } catch (err) {
    next(err);
  }
}

/**
 * Get video by ID with visibility rules and viewer context
 */
async function getVideoById(req, res, next) {
  try {
    const video = await Video.findById(req.params.id)
      .populate('owner', `${OWNER_CARD_FIELDS} subscriberCount`)
      .lean();
    assertCanView(video, req.user);

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

    if (req.user) {
      const [progress, reaction, subscribed] = await Promise.all([
        WatchProgress.findOne({ user: req.user._id, video: video._id }).select('positionSec').lean(),
        Reaction.findOne({ user: req.user._id, video: video._id }).select('value').lean(),
        Subscription.exists({ subscriber: req.user._id, channel: video.owner._id }),
      ]);

      videoObj.viewer = {
        progressSec: progress ? progress.positionSec : 0,
        reaction: reaction ? reaction.value : 0,
        subscribed: !!subscribed,
        isOwner: isVideoOwner(video, req.user),
      };
    }

    res.status(200).json({ video: videoObj });
  } catch (err) {
    next(err);
  }
}

/**
 * Deduplicated view recording (one view per viewer per video per 24h)
 */
async function recordView(req, res, next) {
  try {
    const video = await Video.findById(req.params.id).select('owner status visibility').lean();
    assertCanView(video, req.user);

    let viewerKey;
    if (req.user) {
      viewerKey = req.user._id.toString();
    } else {
      const salt = process.env.VIEW_SALT || 'vidstream_view_salt';
      viewerKey = crypto
        .createHash('sha256')
        .update(`${req.ip}-${req.headers['user-agent'] || ''}-${salt}`)
        .digest('hex');
    }

    let counted = false;
    try {
      await ViewEvent.create({ video: video._id, viewerKey });
      await Video.updateOne({ _id: video._id }, { $inc: { viewCount: 1 } });
      counted = true;
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Duplicate key: already counted in the last 24h
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

    const video = await Video.findById(id).select('owner status visibility').lean();
    assertCanView(video, req.user);

    const position = Math.round(positionSec);
    await WatchProgress.updateOne(
      { user: req.user._id, video: video._id },
      { $set: { positionSec: position, durationSec: durationSec ? Math.round(durationSec) : 0 } },
      { upsert: true }
    );

    res.status(200).json({ success: true, positionSec: position });
  } catch (err) {
    next(err);
  }
}

const PUBLIC_READY = { status: 'ready', visibility: 'public' };

/**
 * List public ready videos with cursor pagination (Home Feed & Search)
 */
async function getVideos(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, 12, 50);
    const q = queryString(req.query.q);
    const tag = queryString(req.query.tag).toLowerCase();
    const requestedSort = queryString(req.query.sort);
    const sort = ['relevance', 'newest', 'views'].includes(requestedSort)
      ? requestedSort
      : q
        ? 'relevance'
        : 'newest';
    const useTextScore = !!q && sort === 'relevance';
    const cursor = decodeCursor(req.query.cursor);

    const query = { ...PUBLIC_READY };
    if (tag && tag !== 'all') query.tags = tag;
    if (q) query.$text = { $search: q };

    let sortOption = { publishedAt: -1, _id: -1 };
    if (sort === 'views') sortOption = { viewCount: -1, _id: -1 };
    if (useTextScore) sortOption = { score: { $meta: 'textScore' }, _id: -1 };

    // Keyset pagination for stable sorts; offset pagination for relevance
    // (text scores cannot be used in range queries).
    let skip = 0;
    if (cursor) {
      if (useTextScore) {
        skip = Math.max(0, parseInt(cursor.offset, 10) || 0);
      } else if (sort === 'views' && typeof cursor.viewCount === 'number' && cursor.id) {
        query.$or = [
          { viewCount: { $lt: cursor.viewCount } },
          { viewCount: cursor.viewCount, _id: { $lt: cursor.id } },
        ];
      } else if (cursor.publishedAt && cursor.id) {
        const cursorDate = new Date(cursor.publishedAt);
        query.$or = [
          { publishedAt: { $lt: cursorDate } },
          { publishedAt: cursorDate, _id: { $lt: cursor.id } },
        ];
      }
    }

    const videos = await Video.find(query, useTextScore ? { score: { $meta: 'textScore' } } : {})
      .sort(sortOption)
      .skip(skip)
      .limit(limit + 1)
      .populate('owner', OWNER_CARD_FIELDS)
      .lean();

    const hasMore = videos.length > limit;
    const items = hasMore ? videos.slice(0, limit) : videos;

    let nextCursor = null;
    if (hasMore) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor(
        useTextScore
          ? { offset: skip + items.length }
          : {
              id: last._id.toString(),
              publishedAt: last.publishedAt || last.createdAt,
              viewCount: last.viewCount || 0,
            }
      );
    }

    res.status(200).json({ items: items.map((v) => toVideoCard(v)), nextCursor });
  } catch (err) {
    next(err);
  }
}

/**
 * Get related videos sharing tags, strictly excluding the current video
 */
async function getRelatedVideos(req, res, next) {
  try {
    const video = await Video.findById(req.params.id)
      .select('owner status visibility tags')
      .lean();
    assertCanView(video, req.user);

    const limit = parseLimit(req.query.limit, 10, 20);
    let related = [];

    if (video.tags?.length) {
      related = await Video.find({ ...PUBLIC_READY, _id: { $ne: video._id }, tags: { $in: video.tags } })
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(limit)
        .populate('owner', OWNER_CARD_FIELDS)
        .lean();
    }

    if (related.length < limit) {
      const excluded = [video._id, ...related.map((v) => v._id)];
      const backfill = await Video.find({ ...PUBLIC_READY, _id: { $nin: excluded } })
        .sort({ publishedAt: -1, _id: -1 })
        .limit(limit - related.length)
        .populate('owner', OWNER_CARD_FIELDS)
        .lean();
      related = related.concat(backfill);
    }

    res.status(200).json({ items: related.map((v) => toVideoCard(v)) });
  } catch (err) {
    next(err);
  }
}

/**
 * Set or clear a like / dislike reaction on a video.
 * Counters are adjusted only for the state transition that actually happened.
 */
async function setReaction(req, res, next) {
  try {
    const { id } = req.params;
    const { value } = req.body; // 1 = like, -1 = dislike, 0 = clear

    const video = await Video.findById(id).select('owner status visibility').lean();
    assertCanView(video, req.user);

    const filter = { user: req.user._id, video: video._id };
    const counterFor = { 1: 'likeCount', [-1]: 'dislikeCount' };
    const inc = {};

    if (value === 0) {
      const removed = await Reaction.findOneAndDelete(filter).lean();
      if (removed) inc[counterFor[removed.value]] = -1;
    } else {
      // Atomically set the new value and get the previous document back
      const previous = await Reaction.findOneAndUpdate(
        filter,
        { $set: { value } },
        { upsert: true, new: false }
      ).lean();
      if (!previous) {
        inc[counterFor[value]] = 1;
      } else if (previous.value !== value) {
        inc[counterFor[value]] = 1;
        inc[counterFor[previous.value]] = -1;
      }
    }

    const updated = Object.keys(inc).length
      ? await Video.findByIdAndUpdate(video._id, { $inc: inc }, { new: true })
          .select('likeCount dislikeCount')
          .lean()
      : await Video.findById(video._id).select('likeCount dislikeCount').lean();

    res.status(200).json({
      success: true,
      userReaction: value,
      likeCount: Math.max(0, updated.likeCount || 0),
      dislikeCount: Math.max(0, updated.dislikeCount || 0),
    });
  } catch (err) {
    if (err.code === 11000) {
      // Two concurrent upserts for the same user/video; the client can safely retry
      return next(new AppError('Reaction update conflict, please retry', 409, 'CONFLICT'));
    }
    next(err);
  }
}

module.exports = {
  markUploaded,
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
