const express = require('express');
const { getMe } = require('../controllers/authController');
const { getMyVideos } = require('../controllers/videoController');
const {
  getWatchHistory,
  clearWatchHistory,
  getLikedVideos,
} = require('../controllers/libraryController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, getMe);
router.get('/videos', requireAuth, getMyVideos);
router.get('/history', requireAuth, getWatchHistory);
router.delete('/history', requireAuth, clearWatchHistory);
router.get('/likes', requireAuth, getLikedVideos);

module.exports = router;
