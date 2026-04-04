const GitHubStrategy = require('passport-github2').Strategy;
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
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`GitHub OAuth not fully configured. Missing: ${missing.join(', ')}`);
  }
}

function setupGitHubStrategy(passport) {
  const githubConfig = getGithubConfig();

  passport.use(
    new GitHubStrategy(
      {
        clientID: githubConfig.clientID,
        clientSecret: githubConfig.clientSecret,
        callbackURL: githubConfig.callbackURL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const mappedUser = mapGitHubProfile(profile);
          const persistedUser = await upsertGithubUser(mappedUser);
          return done(null, persistedUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

function setupSerialization(passport) {
  passport.serializeUser((user, done) => {
    return done(null, user.githubId || user.id);
  });

  passport.deserializeUser(async (sessionValue, done) => {
    try {
      const persistedUser = await findGithubUserById(sessionValue);
      return done(null, persistedUser || null);
    } catch (error) {
      return done(error, null);
    }
  });
}

module.exports = {
  githubConfig: getGithubConfig,
  validateGitHubConfig,
  setupGitHubStrategy,
  setupSerialization
};
