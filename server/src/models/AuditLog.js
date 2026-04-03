const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      index: true
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
