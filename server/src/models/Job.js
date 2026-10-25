const { Schema, model } = require('mongoose');

const jobSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['transcode'],
      default: 'transcode',
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'done', 'failed'],
      default: 'queued',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    runAfter: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ status: 1, runAfter: 1 });

module.exports = model('Job', jobSchema);
