const express = require('express');
const {
  createVideo,
  confirmVideoUpload,
  retryVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/videoController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createVideoSchema } = require('../schemas/video');

const router = express.Router();

router.post('/', requireAuth, validateBody(createVideoSchema), createVideo);
router.post('/:id/confirm', requireAuth, confirmVideoUpload);
router.post('/:id/retry', requireAuth, retryVideo);
router.patch('/:id', requireAuth, updateVideo);
router.delete('/:id', requireAuth, deleteVideo);

module.exports = router;
