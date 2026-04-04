/**
 * GitHub Credentials Utilities
 * Functions for saving, retrieving, and managing GitHub OAuth credentials stored in MongoDB
 */

const User = require('../models/User');

/**
 * Get user credentials by GitHub ID
 * @param {string} githubId - GitHub user ID
 * @returns {Promise<Object|null>} User with GitHub credentials or null
 */
async function getUserByGitHubId(githubId) {
  try {
    const user = await User.findOne({ githubId }).select(
      'username email githubId githubProfile authMethod createdAt'
    );
    return user;
  } catch (error) {
    console.error('Error fetching user by GitHub ID:', error);
    throw error;
  }
}

/**
 * Get user credentials by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User with credentials or null
 */
async function getUserByEmail(email) {
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      'username email githubId githubProfile authMethod createdAt'
    );
    return user;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

/**
 * Get user's GitHub credentials
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} GitHub credentials
 */
async function getGitHubCredentials(userId) {
  try {
    const user = await User.findById(userId).select('githubId githubProfile authMethod');
    
    if (!user || !user.githubId) {
      return null;
    }

    return {
      githubId: user.githubId,
      username: user.githubProfile?.login,
      name: user.githubProfile?.name,
      email: user.githubProfile?.email,
      avatar: user.githubProfile?.avatar_url,
      profileUrl: user.githubProfile?.profile_url,
      bio: user.githubProfile?.bio,
      authMethod: user.authMethod
    };
  } catch (error) {
    console.error('Error fetching GitHub credentials:', error);
    throw error;
  }
}

/**
 * Link GitHub account to existing user
 * @param {string} userId - MongoDB user ID
 * @param {Object} githubProfile - GitHub profile data
 * @returns {Promise<Object>} Updated user
 */
async function linkGitHubAccount(userId, githubProfile) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          githubId: githubProfile.id,
          githubProfile: {
            login: githubProfile.username,
            id: githubProfile.id,
            avatar_url: githubProfile.photos?.[0]?.value,
            profile_url: githubProfile.profileUrl,
            name: githubProfile.displayName,
            bio: githubProfile.bio
          },
          authMethod: 'github'
        }
      },
      { new: true }
    ).select('username email githubId githubProfile authMethod');

    return user;
  } catch (error) {
    console.error('Error linking GitHub account:', error);
    throw error;
  }
}

/**
 * Unlink GitHub account from user
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} Updated user
 */
async function unlinkGitHubAccount(userId) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $unset: {
          githubId: '',
          githubProfile: ''
        },
        $set: {
          authMethod: 'local'
        }
      },
      { new: true }
    ).select('username email authMethod');

    return user;
  } catch (error) {
    console.error('Error unlinking GitHub account:', error);
    throw error;
  }
}

/**
 * Check if user has GitHub credentials
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<boolean>} True if user has GitHub credentials
 */
async function hasGitHubCredentials(userId) {
  try {
    const user = await User.findById(userId).select('githubId');
    return !!user?.githubId;
  } catch (error) {
    console.error('Error checking GitHub credentials:', error);
    throw error;
  }
}

/**
 * Get all users with GitHub credentials
 * @param {Object} options - Query options
 * @param {number} options.limit - Limit results
 * @param {number} options.skip - Skip results
 * @returns {Promise<Array>} Array of users with GitHub credentials
 */
async function getAllGitHubUsers(options = {}) {
  try {
    const { limit = 100, skip = 0 } = options;

    const users = await User.find({ githubId: { $exists: true, $ne: null } })
      .select('username email githubId githubProfile authMethod createdAt')
      .limit(limit)
      .skip(skip)
      .lean();

    return users.map(user => ({
      id: String(user._id),
      username: user.username,
      email: user.email,
      githubId: user.githubId,
      githubLogin: user.githubProfile?.login,
      githubName: user.githubProfile?.name,
      authMethod: user.authMethod,
      createdAt: user.createdAt
    }));
  } catch (error) {
    console.error('Error fetching GitHub users:', error);
    throw error;
  }
}

/**
 * Count users with GitHub credentials
 * @returns {Promise<number>} Count of users with GitHub credentials
 */
async function countGitHubUsers() {
  try {
    const count = await User.countDocuments({ githubId: { $exists: true, $ne: null } });
    return count;
  } catch (error) {
    console.error('Error counting GitHub users:', error);
    throw error;
  }
}

/**
 * Update GitHub profile information
 * @param {string} userId - MongoDB user ID
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} Updated user
 */
async function updateGitHubProfile(userId, profileData) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'githubProfile.name': profileData.displayName,
          'githubProfile.bio': profileData.bio,
          'githubProfile.avatar_url': profileData.photos?.[0]?.value
        }
      },
      { new: true }
    ).select('username email githubId githubProfile');

    return user;
  } catch (error) {
    console.error('Error updating GitHub profile:', error);
    throw error;
  }
}

/**
 * Get user statistics for GitHub OAuth
 * @returns {Promise<Object>} Statistics about GitHub users
 */
async function getGitHubStats() {
  try {
    const totalGitHubUsers = await User.countDocuments({ githubId: { $exists: true, $ne: null } });
    const totalLocalUsers = await User.countDocuments({ githubId: { $exists: false } });
    const totalUsers = await User.countDocuments();

    return {
      totalGitHubUsers,
      totalLocalUsers,
      totalUsers,
      percentageGitHub: totalUsers > 0 ? ((totalGitHubUsers / totalUsers) * 100).toFixed(2) : 0
    };
  } catch (error) {
    console.error('Error calculating GitHub statistics:', error);
    throw error;
  }
}

module.exports = {
  getUserByGitHubId,
  getUserByEmail,
  getGitHubCredentials,
  linkGitHubAccount,
  unlinkGitHubAccount,
  hasGitHubCredentials,
  getAllGitHubUsers,
  countGitHubUsers,
  updateGitHubProfile,
  getGitHubStats
};
