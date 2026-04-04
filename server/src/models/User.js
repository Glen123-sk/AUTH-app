const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      default: null
    },
    // GitHub OAuth fields
    githubId: {
      type: String,
      sparse: true
    },
    githubProfile: {
      type: {
        login: String,
        id: Number,
        avatar_url: String,
        profile_url: String,
        name: String,
        bio: String
      },
      default: null
    },
    // Track authentication method
    authMethod: {
      type: String,
      enum: ['local', 'github'],
      default: 'local'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
