const Video = require('../models/Video');
const { generateSignedUploadParams } = require('../services/storage');
const { enqueueTranscodeJob } = require('../workers/queue');
const { AppError } = require('../middleware/errorHandler');

async function createVideo(req, res, next) {
  try {
    const { title, description, tags, visibility } = req.body;

    // Create the Video record in 'awaiting_upload' status
    const video = await Video.create({
      owner: req.user._id,
      title,
      description: description || '',
      tags: tags || [],
      visibility: visibility || 'public',
      status: 'awaiting_upload',
    });

    // Generate signed upload parameters for Cloudinary direct upload
    const upload = generateSignedUploadParams(video._id.toString());

    res.status(201).json({
      video: {
        id: video._id.toString(),
        status: video.status,
      },
      upload,
    });
  } catch (err) {
    next(err);
  }
}

async function confirmVideoUpload(req, res, next) {
  try {
    const { id } = req.params;
    const { public_id, secure_url } = req.body;

    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404, 'NOT_FOUND');
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: Not the video owner', 403, 'FORBIDDEN');
    }

    if (video.status === 'awaiting_upload') {
      video.status = 'queued';
      video.sourcePublicId = public_id || `vidstream/raw/${video._id}`;
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

    res.status(200).json({
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
  createVideo,
  confirmVideoUpload,
};
