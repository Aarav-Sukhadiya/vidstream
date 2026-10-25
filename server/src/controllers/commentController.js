const Comment = require('../models/Comment');
const Video = require('../models/Video');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get cursor-paginated comments for a video (or replies to a parent comment)
 */
async function getComments(req, res, next) {
  try {
    const { id } = req.params;
    const { parentId, cursor, limit = 20 } = req.query;
    const numLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const query = {
      video: id,
      parent: parentId || null,
    };

    if (cursor) {
      try {
        const decodedDate = new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
        query.createdAt = { $lt: decodedDate };
      } catch {
        // ignore invalid cursor
      }
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .limit(numLimit + 1)
      .populate('author', 'handle displayName avatarUrl')
      .lean();

    const hasMore = comments.length > numLimit;
    const items = hasMore ? comments.slice(0, numLimit) : comments;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(lastItem.createdAt.toISOString()).toString('base64url');
    }

    // Attach reply count for top-level comments
    const itemIds = items.map((c) => c._id);
    const replyCounts = await Comment.aggregate([
      { $match: { parent: { $in: itemIds } } },
      { $group: { _id: '$parent', count: { $sum: 1 } } },
    ]);

    const replyCountMap = {};
    replyCounts.forEach((r) => {
      replyCountMap[r._id.toString()] = r.count;
    });

    const formatted = items.map((c) => ({
      id: c._id.toString(),
      body: c.body,
      createdAt: c.createdAt,
      replyCount: replyCountMap[c._id.toString()] || 0,
      author: {
        id: c.author ? c.author._id.toString() : '',
        handle: c.author?.handle || 'user',
        displayName: c.author?.displayName || 'User',
        avatarUrl: c.author?.avatarUrl || '',
      },
    }));

    res.status(200).json({ items: formatted, nextCursor });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a comment or reply to a video
 */
async function createComment(req, res, next) {
  try {
    const { id } = req.params;
    const { body, parentId } = req.body;

    if (!body || !body.trim()) {
      throw new AppError('Comment body is required', 400, 'VALIDATION');
    }

    if (body.trim().length > 1000) {
      throw new AppError('Comment body cannot exceed 1000 characters', 400, 'VALIDATION');
    }

    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        throw new AppError('Parent comment not found', 404, 'NOT_FOUND');
      }
    }

    const comment = await Comment.create({
      video: id,
      author: req.user._id,
      parent: parentId || null,
      body: body.trim(),
    });

    await Video.updateOne({ _id: id }, { $inc: { commentCount: 1 } });

    res.status(201).json({
      comment: {
        id: comment._id.toString(),
        body: comment.body,
        createdAt: comment.createdAt,
        replyCount: 0,
        author: {
          id: req.user._id.toString(),
          handle: req.user.handle,
          displayName: req.user.displayName,
          avatarUrl: req.user.avatarUrl || '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete own comment
 */
async function deleteComment(req, res, next) {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);

    if (!comment) {
      throw new AppError('Comment not found', 404, 'NOT_FOUND');
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: You can only delete your own comments', 403, 'FORBIDDEN');
    }

    const videoId = comment.video;
    const repliesCount = await Comment.countDocuments({ parent: comment._id });
    const totalDeleted = 1 + repliesCount;

    await Comment.deleteMany({ $or: [{ _id: comment._id }, { parent: comment._id }] });
    await Video.updateOne({ _id: videoId }, { $inc: { commentCount: -totalDeleted } });

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getComments,
  createComment,
  deleteComment,
};
