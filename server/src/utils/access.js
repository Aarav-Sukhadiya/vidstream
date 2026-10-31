const { AppError } = require('../middleware/errorHandler');

function ownerIdOf(video) {
  const owner = video.owner;
  return (owner && owner._id ? owner._id : owner).toString();
}

function isVideoOwner(video, user) {
  return !!user && ownerIdOf(video) === user._id.toString();
}

/**
 * Non-owners can only see ready, non-private videos. Anything else is reported as
 * 404 so the existence of private/processing videos is not leaked.
 */
function assertCanView(video, user) {
  if (!video) throw new AppError('Video not found', 404, 'NOT_FOUND');
  if (isVideoOwner(video, user)) return;
  if (video.visibility === 'private' || video.status !== 'ready') {
    throw new AppError('Video not found', 404, 'NOT_FOUND');
  }
}

function assertOwner(video, user) {
  if (!video) throw new AppError('Video not found', 404, 'NOT_FOUND');
  if (!isVideoOwner(video, user)) {
    throw new AppError('Forbidden: Not the video owner', 403, 'FORBIDDEN');
  }
}

module.exports = { ownerIdOf, isVideoOwner, assertCanView, assertOwner };
