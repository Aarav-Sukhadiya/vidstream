const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const handleHealth = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'ok',
    service: 'vidstream-api',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    db: isDbConnected ? 'connected' : 'disconnected',
  });
};

router.all(['/health', '/healthz', '/ping'], handleHealth);
router.handleHealth = handleHealth;

module.exports = router;
