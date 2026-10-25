const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    handle: {
      type: String,
      required: [true, 'Handle is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Handle must be at least 3 characters'],
      maxlength: [30, 'Handle cannot exceed 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Handle can only contain lowercase letters, numbers, and underscores'],
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    subscriberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password with bcrypt cost 12
userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

// Compare candidate password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Custom serialization to omit passwordHash
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = model('User', userSchema);
