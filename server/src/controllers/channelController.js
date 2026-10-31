const User = require('../models/User');
const Video = require('../models/Video');
const Subscription = require('../models/Subscription');
const { AppError } = require('../middleware/errorHandler');
const {
  OWNER_CARD_FIELDS,
  toVideoCard,
  encodeCursor,
  decodeCursor,
  parseLimit,
} = require('../utils/serializers');

const CHANNEL_VIDEO_LIMIT = 100;

/**
 * Subscribe to a channel (idempotent, rejects self-subscribe)
 */
async function subscribeToChannel(req, res, next) {
  try {
    const { id: channelId } = req.params;

    const channel = await User.findById(channelId).select('_id');
    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND');
    }

    if (channel._id.toString() === req.user._id.toString()) {
      throw new AppError('Cannot subscribe to your own channel', 400, 'VALIDATION');
    }

    try {
      const result = await Subscription.updateOne(
        { subscriber: req.user._id, channel: channel._id },
        { $setOnInsert: { subscriber: req.user._id, channel: channel._id } },
        { upsert: true }
      );
      if (result.upsertedCount) {
        await User.updateOne({ _id: channel._id }, { $inc: { subscriberCount: 1 } });
      }
    } catch (err) {
      // concurrent duplicate subscribe: already subscribed
      if (err.code !== 11000) throw err;
    }

    const updated = await User.findById(channel._id).select('subscriberCount');

    res.status(200).json({
      subscribed: true,
      subscriberCount: updated.subscriberCount || 0,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Unsubscribe from a channel (idempotent)
 */
async function unsubscribeFromChannel(req, res, next) {
  try {
    const { id: channelId } = req.params;

    const channel = await User.findById(channelId).select('_id');
    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND');
    }

    const deleted = await Subscription.findOneAndDelete({
      subscriber: req.user._id,
      channel: channel._id,
    });

    if (deleted) {
      await User.updateOne(
        { _id: channel._id, subscriberCount: { $gt: 0 } },
        { $inc: { subscriberCount: -1 } }
      );
    }

    const updated = await User.findById(channel._id).select('subscriberCount');

    res.status(200).json({
      subscribed: false,
      subscriberCount: Math.max(0, updated?.subscriberCount || 0),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get channel profile and its public ready videos
 */
async function getChannelProfile(req, res, next) {
  try {
    const handle = String(req.params.handle).toLowerCase().trim();

    const channel = await User.findOne({ handle }).select(
      'handle displayName bio avatarUrl subscriberCount'
    );
    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND');
    }

    const publicVideos = { owner: channel._id, status: 'ready', visibility: 'public' };
    const [videos, videoCount, isSubscribed] = await Promise.all([
      Video.find(publicVideos)
        .sort({ publishedAt: -1, _id: -1 })
        .limit(CHANNEL_VIDEO_LIMIT)
        .lean(),
      Video.countDocuments(publicVideos),
      req.user
        ? Subscription.exists({ subscriber: req.user._id, channel: channel._id })
        : Promise.resolve(null),
    ]);

    const formattedVideos = videos.map((v) => toVideoCard(v, channel));

    res.status(200).json({
      channel: {
        id: channel._id.toString(),
        handle: channel.handle,
        displayName: channel.displayName,
        bio: channel.bio || '',
        avatarUrl: channel.avatarUrl || '',
        subscriberCount: channel.subscriberCount || 0,
        videoCount,
        isSubscribed: !!isSubscribed,
      },
      videos: formattedVideos,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get subscriptions feed (newest public ready videos from subscribed channels only)
 */
async function getSubscriptionsFeed(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, 12, 50);
    const cursor = decodeCursor(req.query.cursor);

    const subscriptions = await Subscription.find({ subscriber: req.user._id })
      .select('channel')
      .lean();

    const channelIds = subscriptions.map((s) => s.channel);

    if (channelIds.length === 0) {
      return res.status(200).json({ items: [], nextCursor: null });
    }

    const query = {
      owner: { $in: channelIds },
      status: 'ready',
      visibility: 'public',
    };

    if (cursor?.publishedAt && cursor.id) {
      const cursorDate = new Date(cursor.publishedAt);
      query.$or = [
        { publishedAt: { $lt: cursorDate } },
        { publishedAt: cursorDate, _id: { $lt: cursor.id } },
      ];
    }

    const videos = await Video.find(query)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('owner', OWNER_CARD_FIELDS)
      .lean();

    const hasMore = videos.length > limit;
    const items = hasMore ? videos.slice(0, limit) : videos;

    const last = items[items.length - 1];
    const nextCursor = hasMore
      ? encodeCursor({ id: last._id.toString(), publishedAt: last.publishedAt || last.createdAt })
      : null;

    res.status(200).json({ items: items.map((v) => toVideoCard(v)), nextCursor });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelProfile,
  getSubscriptionsFeed,
};
