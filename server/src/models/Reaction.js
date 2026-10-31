const { Schema, model } = require('mongoose');

const reactionSchema = new Schema(
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
    value: {
      type: Number,
      required: true,
      enum: [1, -1], // 1 = like, -1 = dislike
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring one reaction per user per video
reactionSchema.index({ user: 1, video: 1 }, { unique: true });
reactionSchema.index({ user: 1, value: 1, updatedAt: -1 });

module.exports = model('Reaction', reactionSchema);
