const express = require('express');
const { createVideo } = require('../controllers/videoController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createVideoSchema } = require('../schemas/video');

const router = express.Router();

router.post('/', requireAuth, validateBody(createVideoSchema), createVideo);

module.exports = router;
