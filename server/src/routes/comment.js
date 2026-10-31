const express = require('express');
const { deleteComment } = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');
const { validateObjectIdParam } = require('../middleware/validate');

const router = express.Router();

router.param('id', validateObjectIdParam('id'));
router.delete('/:id', requireAuth, deleteComment);

module.exports = router;
