const express = require('express');
const { getSubscriptionsFeed } = require('../controllers/channelController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/subscriptions', requireAuth, getSubscriptionsFeed);

module.exports = router;
