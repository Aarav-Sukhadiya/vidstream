const express = require('express');
const {
  getVideos,
  getRelatedVideos,
  createVideo,
  confirmVideoUpload,
  getVideoById,
  recordView,
  saveProgress,
  setReaction,
  retryVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/videoController');
const { getComments, createComment } = require('../controllers/commentController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validateBody, validateObjectIdParam } = require('../middleware/validate');
const { commentRateLimiter, reactionRateLimiter } = require('../middleware/rateLimit');
const {
  createVideoSchema,
  updateVideoSchema,
  confirmUploadSchema,
  progressSchema,
  reactionSchema,
  createCommentSchema,
} = require('../schemas/video');

const router = express.Router();

router.get('/', getVideos);
router.post('/', requireAuth, validateBody(createVideoSchema), createVideo);

router.param('id', validateObjectIdParam('id'));

router.get('/:id', optionalAuth, getVideoById);
router.patch('/:id', requireAuth, validateBody(updateVideoSchema), updateVideo);
router.delete('/:id', requireAuth, deleteVideo);
router.get('/:id/related', optionalAuth, getRelatedVideos);
router.post('/:id/confirm', requireAuth, validateBody(confirmUploadSchema), confirmVideoUpload);
router.post('/:id/retry', requireAuth, retryVideo);
router.post('/:id/view', optionalAuth, recordView);
router.put('/:id/progress', requireAuth, validateBody(progressSchema), saveProgress);
router.put('/:id/reaction', requireAuth, reactionRateLimiter, validateBody(reactionSchema), setReaction);
router.get('/:id/comments', optionalAuth, getComments);
router.post(
  '/:id/comments',
  requireAuth,
  commentRateLimiter,
  validateBody(createCommentSchema),
  createComment
);

module.exports = router;
