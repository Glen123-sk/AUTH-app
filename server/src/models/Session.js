const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    },
    tokenIssuedAt: {
      type: Date,
      required: true
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokedReason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, revokedAt: 1, expiresAt: -1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
