const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const { upsertGithubUser, findGithubUserById } = require('./githubFileStore');

function getGithubConfig() {
  return {
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/auth/github/callback'
  };
}

function mapGitHubProfile(profile) {
  return {
    id: String(profile.id || ''),
    username: profile.username || '',
    email: profile.emails?.[0]?.value || `${profile.username || 'github_user'}@github.local`,
    githubId: String(profile.id || ''),
    githubProfile: {
      login: profile.username || '',
      id: profile.id,
      avatar_url: profile.photos?.[0]?.value,
      profile_url: profile.profileUrl,
      name: profile.displayName,
      bio: profile.bio
    },
    authMethod: 'github'
  };
}

function validateGitHubConfig() {
  const required = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  GitHub OAuth not fully configured. Missing: ${missing.join(', ')}`);
    console.warn('   GitHub login will not work until these are set in .env');
  }
}

// Passport strategy for GitHub
function setupGitHubStrategy(passport, options = {}) {
  const useDatabase = options.useDatabase !== false;
  const githubConfig = getGithubConfig();

  passport.use(
    new GitHubStrategy(
      {
        clientID: githubConfig.clientID,
        clientSecret: githubConfig.clientSecret,
        callbackURL: githubConfig.callbackURL
      },
      async (accessToken, refreshToken, profile, done) => {
        if (!useDatabase) {
          try {
            const mappedUser = mapGitHubProfile(profile);
            const persistedUser = await upsertGithubUser(mappedUser);
            return done(null, persistedUser);
          } catch (error) {
            return done(error, null);
          }
        }

        try {
          // Check if user exists by GitHub ID
          let user = await User.findOne({ githubId: profile.id });

          if (user) {
            // Update profile info
            user.githubProfile = {
              login: profile.username,
              id: profile.id,
              avatar_url: profile.photos?.[0]?.value,
              profile_url: profile.profileUrl,
              name: profile.displayName,
              bio: profile.bio
            };
            await user.save();
            return done(null, user);
          }

          // Check if user exists by email
          user = await User.findOne({ email: profile.emails?.[0]?.value });

          if (user) {
            // Link GitHub account to existing user
            user.githubId = profile.id;
            user.githubProfile = {
              login: profile.username,
              id: profile.id,
              avatar_url: profile.photos?.[0]?.value,
              profile_url: profile.profileUrl,
              name: profile.displayName,
              bio: profile.bio
            };
            await user.save();
            return done(null, user);
          }

          // Create new user
          user = await User.create({
            username: profile.username,
            email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
            githubId: profile.id,
            authMethod: 'github',
            githubProfile: {
              login: profile.username,
              id: profile.id,
              avatar_url: profile.photos?.[0]?.value,
              profile_url: profile.profileUrl,
              name: profile.displayName,
              bio: profile.bio
            }
          });

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
}

// Serialize and deserialize user for session
function setupSerialization(passport, options = {}) {
  const useDatabase = options.useDatabase !== false;

  passport.serializeUser((user, done) => {
    if (!useDatabase) {
      return done(null, user.githubId || user.id);
    }
    done(null, user.id);
  });

  passport.deserializeUser(async (sessionValue, done) => {
    if (!useDatabase) {
      try {
        const persistedUser = await findGithubUserById(sessionValue);
        return done(null, persistedUser || null);
      } catch (error) {
        return done(error, null);
      }
    }

    try {
      const user = await User.findById(sessionValue);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

module.exports = {
  githubConfig: getGithubConfig,
  validateGitHubConfig,
  setupGitHubStrategy,
  setupSerialization
};
