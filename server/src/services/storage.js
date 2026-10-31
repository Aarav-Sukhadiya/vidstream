const cloudinary = require('cloudinary').v2;

const MOCK_CLOUD = 'mock_cloud';

function getConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || MOCK_CLOUD,
    apiKey: process.env.CLOUDINARY_API_KEY || 'mock_key',
    apiSecret: process.env.CLOUDINARY_API_SECRET || 'mock_secret',
    folder: process.env.CLOUDINARY_FOLDER || 'vidstream',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'vidstream_raw',
  };
}

const initial = getConfig();
cloudinary.config({
  cloud_name: initial.cloudName,
  api_key: initial.apiKey,
  api_secret: initial.apiSecret,
  secure: true,
});

function isCloudinaryConfigured() {
  return getConfig().cloudName !== MOCK_CLOUD;
}

function getRawFolder() {
  return `${getConfig().folder}/raw`;
}

function generateSignedUploadParams(videoId) {
  const { cloudName, apiKey, apiSecret, uploadPreset } = getConfig();
  const folder = getRawFolder();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${videoId}`;

  const signature = cloudinary.utils.api_sign_request(
    { folder, public_id: publicId, timestamp, upload_preset: uploadPreset },
    apiSecret
  );

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

/**
 * Only accept source URLs that point at our own Cloudinary account, so clients
 * cannot make the worker download arbitrary URLs.
 */
function isTrustedSourceUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${getConfig().cloudName}/`)
    );
  } catch {
    return false;
  }
}

/** Build the delivery URL of an uploaded raw video from its public id. */
function buildSourceUrl(publicId) {
  return cloudinary.url(publicId, { resource_type: 'video', secure: true });
}

async function deleteSourceAsset(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  getRawFolder,
  generateSignedUploadParams,
  isTrustedSourceUrl,
  buildSourceUrl,
  deleteSourceAsset,
};
