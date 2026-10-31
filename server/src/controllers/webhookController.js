const mongoose = require('mongoose');
const Video = require('../models/Video');
const { cloudinary } = require('../services/storage');
const { AppError } = require('../middleware/errorHandler');
const { markUploaded } = require('./videoController');

// Reject notifications older than this to limit replay attacks
const SIGNATURE_MAX_AGE_SEC = 2 * 60 * 60;

function verifySignature(req) {
  const timestamp = req.headers['x-cld-timestamp'];
  const signature = req.headers['x-cld-signature'];

  if (!signature || !timestamp) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Missing webhook signature', 400, 'VALIDATION');
    }
    return; // allow unsigned notifications in development/test
  }

  // Cloudinary signs the exact raw body; re-serialising req.body can change it
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const isValid = cloudinary.utils.verifyNotificationSignature(
    rawBody,
    Number(timestamp),
    signature,
    SIGNATURE_MAX_AGE_SEC
  );
  if (!isValid) {
    throw new AppError('Invalid webhook signature', 400, 'VALIDATION');
  }
}

async function handleCloudinaryWebhook(req, res, next) {
  try {
    verifySignature(req);

    const { public_id, secure_url } = req.body;
    if (!public_id || typeof public_id !== 'string') {
      throw new AppError('Missing public_id in webhook payload', 400, 'VALIDATION');
    }

    // public_id looks like "<folder>/raw/<videoId>" or "<videoId>"
    const videoId = public_id.split('/').pop();
    const video = mongoose.isValidObjectId(videoId) ? await Video.findById(videoId) : null;
    if (!video) {
      throw new AppError('Video not found for this asset', 404, 'NOT_FOUND');
    }

    await markUploaded(video, { publicId: public_id, secureUrl: secure_url });

    res.status(202).json({ video: { id: video._id.toString(), status: video.status } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleCloudinaryWebhook,
};
