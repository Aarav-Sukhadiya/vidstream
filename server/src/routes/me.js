const express = require('express');
const { getMe } = require('../controllers/authController');
const { getMyVideos } = require('../controllers/videoController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, getMe);
router.get('/videos', requireAuth, getMyVideos);

module.exports = router;
