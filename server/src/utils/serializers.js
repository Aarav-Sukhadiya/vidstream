/**
 * Shared response serializers so every endpoint returns the same video/channel shapes.
 */

const OWNER_CARD_FIELDS = 'handle displayName avatarUrl';

function toChannel(owner) {
  return {
    id: owner?._id ? owner._id.toString() : '',
    handle: owner?.handle || 'creator',
    displayName: owner?.displayName || 'Creator',
    avatarUrl: owner?.avatarUrl || '',
  };
}

/**
 * Compact public video representation used by feeds, search, channel pages and library.
 * `owner` may be passed explicitly when the video's owner was not populated.
 */
function toVideoCard(video, owner = video.owner) {
  return {
    id: video._id.toString(),
    title: video.title,
    description: video.description,
    tags: video.tags,
    thumbnailUrl: video.thumbnailUrl,
    durationSec: video.durationSec,
    viewCount: video.viewCount || 0,
    likeCount: video.likeCount || 0,
    publishedAt: video.publishedAt || video.createdAt,
    channel: toChannel(owner),
  };
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor) {
  if (typeof cursor !== 'string' || !cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

/** Parse a `limit` query param into a bounded integer. */
function parseLimit(value, fallback, max) {
  return Math.min(Math.max(parseInt(value, 10) || fallback, 1), max);
}

/** Coerce a query value to a trimmed string (Express may give arrays/objects). */
function queryString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  OWNER_CARD_FIELDS,
  toChannel,
  toVideoCard,
  encodeCursor,
  decodeCursor,
  parseLimit,
  queryString,
};
