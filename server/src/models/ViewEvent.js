const { Schema, model } = require('mongoose');

const viewEventSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    viewerKey: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 24 * 60 * 60, // 24-hour TTL index
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound unique index for deduplication
viewEventSchema.index({ video: 1, viewerKey: 1 }, { unique: true });

module.exports = model('ViewEvent', viewEventSchema);
