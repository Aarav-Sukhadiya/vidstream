const express = require('express');
const { deleteComment } = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.delete('/:id', requireAuth, deleteComment);

module.exports = router;
