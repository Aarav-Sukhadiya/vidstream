const User = require('../models/User');
const Video = require('../models/Video');
const Subscription = require('../models/Subscription');
const { AppError } = require('../middleware/errorHandler');

/**
 * Subscribe to a channel (idempotent, rejects self-subscribe)
 */
async function subscribeToChannel(req, res, next) {
  try {
    const { id: channelId } = req.params;

    const channel = await User.findById(channelId);
    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND');
    }

    if (channel._id.toString() === req.user._id.toString()) {
      throw new AppError('Cannot subscribe to your own channel', 400, 'VALIDATION');
    }

    const existing = await Subscription.findOne({
      subscriber: req.user._id,
      channel: channel._id,
    });

    if (!existing) {
      try {
        await Subscription.create({
          subscriber: req.user._id,
          channel: channel._id,
        });
        await User.updateOne({ _id: channel._id }, { $inc: { subscriberCount: 1 } });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
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

    const channel = await User.findById(channelId);
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
    const handle = req.params.handle.toLowerCase().trim();

    const channel = await User.findOne({ handle }).select(
      'handle displayName bio avatarUrl subscriberCount'
    );
    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND');
    }

    const videos = await Video.find({
      owner: channel._id,
      status: 'ready',
      visibility: 'public',
    })
      .sort({ publishedAt: -1, _id: -1 })
      .lean();

    let isSubscribed = false;
    if (req.user) {
      isSubscribed = !!(await Subscription.exists({
        subscriber: req.user._id,
        channel: channel._id,
      }));
    }

    const formattedVideos = videos.map((v) => ({
      id: v._id.toString(),
      title: v.title,
      description: v.description,
      tags: v.tags,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount,
      publishedAt: v.publishedAt || v.createdAt,
      channel: {
        id: channel._id.toString(),
        handle: channel.handle,
        displayName: channel.displayName,
        avatarUrl: channel.avatarUrl,
      },
    }));

    res.status(200).json({
      channel: {
        id: channel._id.toString(),
        handle: channel.handle,
        displayName: channel.displayName,
        bio: channel.bio || '',
        avatarUrl: channel.avatarUrl || '',
        subscriberCount: channel.subscriberCount || 0,
        videoCount: videos.length,
        isSubscribed,
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
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const { cursor } = req.query;

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

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (decoded.publishedAt) {
          const cursorDate = new Date(decoded.publishedAt);
          query.$or = [
            { publishedAt: { $lt: cursorDate } },
            { publishedAt: cursorDate, _id: { $lt: decoded.id } },
          ];
        }
      } catch {
        // ignore invalid cursor
      }
    }

    const videos = await Video.find(query)
      .sort({ publishedAt: -1, _id: -1 })
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

module.exports = {
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelProfile,
  getSubscriptionsFeed,
};
