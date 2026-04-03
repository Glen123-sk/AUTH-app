const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    displayName: {
      type: String,
      default: ''
    },
    fullName: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    avatarUrl: {
      type: String,
      default: ''
    },
    phoneNumber: {
      type: String,
      default: ''
    },
    company: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      default: ''
    },
    location: {
      type: String,
      default: ''
    },
    timezone: {
      type: String,
      default: ''
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserProfile', userProfileSchema);
