const { Schema, model } = require('mongoose');

const videoSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 5000 },
    tags: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 30 }],
      default: [],
      validate: { validator: (v) => v.length <= 10, message: 'At most 10 tags' },
    },
    visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
    status: {
      type: String,
      enum: ['awaiting_upload', 'queued', 'processing', 'ready', 'failed'],
      default: 'awaiting_upload',
      index: true,
    },
    failureReason: String,
    sourcePublicId: String,
    sourceUrl: String,
    hlsUrl: String,
    thumbnailUrl: String,
    thumbnailPublicId: String,
    durationSec: Number,
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    publishedAt: Date,
  },
  { timestamps: true }
);

videoSchema.index(
  { title: 'text', tags: 'text', description: 'text' },
  { weights: { title: 10, tags: 5, description: 1 } }
);
videoSchema.index({ status: 1, visibility: 1, publishedAt: -1 });
videoSchema.index({ tags: 1, publishedAt: -1 });
videoSchema.index({ owner: 1, createdAt: -1 });

module.exports = model('Video', videoSchema);
