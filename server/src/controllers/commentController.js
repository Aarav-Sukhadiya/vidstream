const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Video = require('../models/Video');
const { AppError } = require('../middleware/errorHandler');
const { assertCanView } = require('../utils/access');
const {
  encodeCursor,
  decodeCursor,
  parseLimit,
  queryString,
  toChannel,
} = require('../utils/serializers');

function toCommentResponse(comment, author, replyCount = 0) {
  const channel = toChannel(author);
  return {
    id: comment._id.toString(),
    parentId: comment.parent ? comment.parent.toString() : null,
    body: comment.body,
    createdAt: comment.createdAt,
    replyCount,
    author: {
      id: channel.id,
      handle: author?.handle || 'user',
      displayName: author?.displayName || 'User',
      avatarUrl: channel.avatarUrl,
    },
  };
}

async function loadViewableVideo(id, user) {
  const video = await Video.findById(id).select('owner status visibility').lean();
  assertCanView(video, user);
  return video;
}

/**
 * Get cursor-paginated comments for a video.
 * Top-level comments are newest first; replies (?parentId=) are oldest first so
 * threads read top to bottom.
 */
async function getComments(req, res, next) {
  try {
    const video = await loadViewableVideo(req.params.id, req.user);
    const limit = parseLimit(req.query.limit, 20, 50);
    const parentId = queryString(req.query.parentId) || null;

    if (parentId && !mongoose.isValidObjectId(parentId)) {
      throw new AppError('Invalid parentId', 400, 'VALIDATION');
    }

    const direction = parentId ? 1 : -1;
    const query = { video: video._id, parent: parentId };

    const cursor = decodeCursor(req.query.cursor);
    if (cursor?.createdAt && cursor.id && mongoose.isValidObjectId(cursor.id)) {
      const op = direction === 1 ? '$gt' : '$lt';
      const at = new Date(cursor.createdAt);
      query.$or = [{ createdAt: { [op]: at } }, { createdAt: at, _id: { [op]: cursor.id } }];
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: direction, _id: direction })
      .limit(limit + 1)
      .populate('author', 'handle displayName avatarUrl')
      .lean();

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;

    let nextCursor = null;
    if (hasMore) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt, id: last._id.toString() });
    }

    // Reply counts only make sense for top-level comments
    const replyCountMap = {};
    if (!parentId && items.length) {
      const replyCounts = await Comment.aggregate([
        { $match: { parent: { $in: items.map((c) => c._id) } } },
        { $group: { _id: '$parent', count: { $sum: 1 } } },
      ]);
      for (const r of replyCounts) replyCountMap[r._id.toString()] = r.count;
    }

    res.status(200).json({
      items: items.map((c) => toCommentResponse(c, c.author, replyCountMap[c._id.toString()] || 0)),
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a comment or reply to a video. Replies are kept one level deep: replying to
 * a reply attaches the new comment to the same top-level thread.
 */
async function createComment(req, res, next) {
  try {
    const video = await loadViewableVideo(req.params.id, req.user);
    const { body, parentId } = req.body;

    let parent = null;
    if (parentId) {
      const parentComment = await Comment.findById(parentId).select('video parent').lean();
      if (!parentComment || parentComment.video.toString() !== video._id.toString()) {
        throw new AppError('Parent comment not found', 404, 'NOT_FOUND');
      }
      parent = parentComment.parent || parentComment._id;
    }

    const comment = await Comment.create({
      video: video._id,
      author: req.user._id,
      parent,
      body,
    });

    await Video.updateOne({ _id: video._id }, { $inc: { commentCount: 1 } });

    res.status(201).json({ comment: toCommentResponse(comment, req.user) });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete own comment (and its replies)
 */
async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      throw new AppError('Comment not found', 404, 'NOT_FOUND');
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: You can only delete your own comments', 403, 'FORBIDDEN');
    }

    const { deletedCount } = await Comment.deleteMany({
      $or: [{ _id: comment._id }, { parent: comment._id }],
    });
    await Video.updateOne(
      { _id: comment.video },
      [{ $set: { commentCount: { $max: [0, { $subtract: ['$commentCount', deletedCount] }] } } }]
    );

    res.status(200).json({ success: true, message: 'Comment deleted successfully', deletedCount });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getComments,
  createComment,
  deleteComment,
};
