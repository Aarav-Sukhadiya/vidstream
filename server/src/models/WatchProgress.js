const { Schema, model } = require('mongoose');

const watchProgressSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    positionSec: {
      type: Number,
      required: true,
      default: 0,
    },
    durationSec: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

watchProgressSchema.index({ user: 1, video: 1 }, { unique: true });
watchProgressSchema.index({ user: 1, updatedAt: -1 });

module.exports = model('WatchProgress', watchProgressSchema);
