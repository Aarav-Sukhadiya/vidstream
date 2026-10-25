const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret',
});

function generateSignedUploadParams(videoId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud';
  const apiKey = process.env.CLOUDINARY_API_KEY || 'mock_key';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'mock_secret';
  const folder = `${process.env.CLOUDINARY_FOLDER || 'vidstream'}/raw`;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'vidstream_raw';

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${videoId}`;

  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp,
    upload_preset: uploadPreset,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    url: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    method: 'POST',
    fields: {
      api_key: apiKey,
      timestamp,
      signature,
      folder,
      upload_preset: uploadPreset,
      public_id: publicId,
    },
    expiresInSec: 900,
  };
}

module.exports = {
  cloudinary,
  generateSignedUploadParams,
};
