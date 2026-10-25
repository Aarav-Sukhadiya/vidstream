const express = require('express');
const {
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelProfile,
} = require('../controllers/channelController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.put('/:id/subscription', requireAuth, subscribeToChannel);
router.delete('/:id/subscription', requireAuth, unsubscribeFromChannel);
router.get('/:handle', optionalAuth, getChannelProfile);

module.exports = router;
