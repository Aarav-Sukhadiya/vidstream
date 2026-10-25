const Video = require('../models/Video');
const { enqueueTranscodeJob } = require('../workers/queue');
const { cloudinary } = require('../services/storage');
const { AppError } = require('../middleware/errorHandler');

async function handleCloudinaryWebhook(req, res, next) {
  try {
    const timestamp = req.headers['x-cld-timestamp'];
    const signature = req.headers['x-cld-signature'];

    // Verify signature if provided or in production
    if (signature && timestamp) {
      const isValid = cloudinary.utils.verifyNotificationSignature(
        JSON.stringify(req.body),
        timestamp,
        signature
      );
      if (!isValid) {
        throw new AppError('Invalid webhook signature', 400, 'VALIDATION');
      }
    } else if (!signature && process.env.NODE_ENV === 'production') {
      throw new AppError('Missing webhook signature', 400, 'VALIDATION');
    }

    const { public_id, secure_url } = req.body;
    if (!public_id) {
      throw new AppError('Missing public_id in webhook payload', 400, 'VALIDATION');
    }

    // Extract video ID from public_id (e.g. vidstream/raw/6730... or 6730...)
    const videoId = public_id.split('/').pop();

    const video = await Video.findById(videoId);
    if (!video) {
      throw new AppError('Video not found for this asset', 404, 'NOT_FOUND');
    }

    // Transition status to queued if awaiting_upload
    if (video.status === 'awaiting_upload') {
      video.status = 'queued';
      video.sourcePublicId = public_id;
      if (secure_url) {
        video.hlsUrl = secure_url;
      }
      await video.save();

      // Enqueue transcode job
      await enqueueTranscodeJob(video._id);

      // Emit real-time status update via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.emit('video:status', {
          videoId: video._id.toString(),
          status: 'queued',
        });
      }
    }

    res.status(202).json({
      video: {
        id: video._id.toString(),
        status: video.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleCloudinaryWebhook,
};
