const WatchProgress = require('../models/WatchProgress');
const Reaction = require('../models/Reaction');
const { OWNER_CARD_FIELDS, toVideoCard, parseLimit } = require('../utils/serializers');

const populateVideoWithOwner = {
  path: 'video',
  select: 'title description tags thumbnailUrl durationSec viewCount likeCount publishedAt createdAt status visibility owner',
  populate: { path: 'owner', select: OWNER_CARD_FIELDS },
};

/** A library entry is shown only when its video still exists and is watchable. */
const isWatchable = (video) => video && video.status === 'ready' && video.visibility !== 'private';

/**
 * Get user watch history, most recently watched first
 */
async function getWatchHistory(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, 100, 200);
    const history = await WatchProgress.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate(populateVideoWithOwner)
      .lean();

    const items = history
      .filter((h) => isWatchable(h.video))
      .map((h) => {
        const duration = h.durationSec || h.video.durationSec || 0;
        return {
          id: h._id.toString(),
          video: toVideoCard(h.video),
          positionSec: h.positionSec,
          durationSec: duration,
          progressPercent:
            duration > 0 ? Math.min(100, Math.round((h.positionSec / duration) * 100)) : 0,
          updatedAt: h.updatedAt,
        };
      });

    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Clear all watch history for authenticated user
 */
async function clearWatchHistory(req, res, next) {
  try {
    await WatchProgress.deleteMany({ user: req.user._id });
    res.status(200).json({ success: true, message: 'Watch history cleared successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * Get liked videos for authenticated user (newest liked first)
 */
async function getLikedVideos(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, 100, 200);
    const reactions = await Reaction.find({ user: req.user._id, value: 1 })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate(populateVideoWithOwner)
      .lean();

    const items = reactions
      .filter((r) => isWatchable(r.video))
      .map((r) => ({ ...toVideoCard(r.video), likedAt: r.updatedAt || r.createdAt }));

    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWatchHistory,
  clearWatchHistory,
  getLikedVideos,
};
