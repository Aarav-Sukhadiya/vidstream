const { Schema, model } = require('mongoose');

const refreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // TTL index; MongoDB automatically deletes documents when expiresAt is reached
    },
    replacedBy: {
      type: String,
      default: null,
    },
    revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('RefreshToken', refreshTokenSchema);
