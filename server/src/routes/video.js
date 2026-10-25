const express = require('express');
const {
  getVideos,
  createVideo,
  confirmVideoUpload,
  getVideoById,
  recordView,
  saveProgress,
  retryVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/videoController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createVideoSchema } = require('../schemas/video');

const router = express.Router();

router.get('/', getVideos);
router.post('/', requireAuth, validateBody(createVideoSchema), createVideo);
router.get('/:id', optionalAuth, getVideoById);
router.post('/:id/confirm', requireAuth, confirmVideoUpload);
router.post('/:id/view', optionalAuth, recordView);
router.put('/:id/progress', requireAuth, saveProgress);
router.post('/:id/retry', requireAuth, retryVideo);
router.patch('/:id', requireAuth, updateVideo);
router.delete('/:id', requireAuth, deleteVideo);

module.exports = router;
