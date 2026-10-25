const express = require('express');
const { handleCloudinaryWebhook } = require('../controllers/webhookController');

const router = express.Router();

router.post('/cloudinary', handleCloudinaryWebhook);

module.exports = router;
