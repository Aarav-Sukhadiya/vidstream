const Video = require('../models/Video');
const { generateSignedUploadParams } = require('../services/storage');

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

module.exports = {
  createVideo,
};
