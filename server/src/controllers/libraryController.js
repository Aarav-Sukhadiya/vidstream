const WatchProgress = require('../models/WatchProgress');
const Reaction = require('../models/Reaction');

/**
 * Get user watch history sorted by updatedAt descending
 */
async function getWatchHistory(req, res, next) {
  try {
    const history = await WatchProgress.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'video',
        populate: { path: 'owner', select: 'handle displayName avatarUrl' },
      })
      .lean();

    // Filter out deleted videos or videos that are not accessible
    const validHistory = history.filter(
      (h) => h.video && h.video.status === 'ready' && h.video.visibility !== 'private'
    );

    const items = validHistory.map((h) => {
      const vidDuration = h.durationSec || h.video.durationSec || 0;
      const progressPercent =
        vidDuration > 0 ? Math.min(100, Math.round((h.positionSec / vidDuration) * 100)) : 0;

      return {
        id: h._id.toString(),
        video: {
          id: h.video._id.toString(),
          title: h.video.title,
          description: h.video.description,
          tags: h.video.tags,
          thumbnailUrl: h.video.thumbnailUrl,
          durationSec: h.video.durationSec,
          viewCount: h.video.viewCount,
          publishedAt: h.video.publishedAt || h.video.createdAt,
          channel: {
            id: h.video.owner ? h.video.owner._id.toString() : '',
            handle: h.video.owner?.handle || 'creator',
            displayName: h.video.owner?.displayName || 'Creator',
            avatarUrl: h.video.owner?.avatarUrl || '',
          },
        },
        positionSec: h.positionSec,
        durationSec: vidDuration,
        progressPercent,
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
    res.status(200).json({
      success: true,
      message: 'Watch history cleared successfully',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get liked videos for authenticated user (newest liked first)
 */
async function getLikedVideos(req, res, next) {
  try {
    const reactions = await Reaction.find({ user: req.user._id, value: 1 })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate({
        path: 'video',
        populate: { path: 'owner', select: 'handle displayName avatarUrl' },
      })
      .lean();

    const validLikes = reactions.filter(
      (r) => r.video && r.video.status === 'ready' && r.video.visibility !== 'private'
    );

    const items = validLikes.map((r) => ({
      id: r.video._id.toString(),
      title: r.video.title,
      description: r.video.description,
      tags: r.video.tags,
      thumbnailUrl: r.video.thumbnailUrl,
      durationSec: r.video.durationSec,
      viewCount: r.video.viewCount,
      likeCount: r.video.likeCount,
      publishedAt: r.video.publishedAt || r.video.createdAt,
      likedAt: r.updatedAt || r.createdAt,
      channel: {
        id: r.video.owner ? r.video.owner._id.toString() : '',
        handle: r.video.owner?.handle || 'creator',
        displayName: r.video.owner?.displayName || 'Creator',
        avatarUrl: r.video.owner?.avatarUrl || '',
      },
    }));

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
