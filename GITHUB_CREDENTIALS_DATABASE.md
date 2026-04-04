# GitHub Credentials Database Management

This guide explains how GitHub OAuth credentials are saved to and retrieved from MongoDB, including database schema, API endpoints, and utility functions.

## Database Schema

### User Model Changes

When a user signs up via GitHub, the following fields are added to the User collection:

```javascript
{
  // Basic user info
  username: String,           // GitHub username
  email: String,              // GitHub email
  authMethod: String,         // 'github' or 'local'
  
  // GitHub OAuth credentials
  githubId: String,           // GitHub user ID (unique index)
  githubProfile: {
    login: String,            // GitHub username
    id: Number,               // GitHub user ID
    avatar_url: String,       // GitHub avatar URL
    profile_url: String,      // GitHub profile URL
    name: String,             // User's full name
    bio: String               // GitHub bio
  },
  
  // Standard fields
  passwordHash: String,       // null if GitHub-only account
  createdAt: Date,            // Account creation date
  updatedAt: Date             // Last update date
}
```

### Database Example

```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "username": "octocat",
  "email": "octocat@github.com",
  "authMethod": "github",
  "githubId": "1",
  "githubProfile": {
    "login": "octocat",
    "id": 1,
    "avatar_url": "https://avatars.githubusercontent.com/u/1?v=4",
    "profile_url": "https://github.com/octocat",
    "name": "The Octocat",
    "bio": "There once was..."
  },
  "passwordHash": null,
  "createdAt": ISODate("2023-01-01T12:00:00Z"),
  "updatedAt": ISODate("2023-01-01T12:00:00Z")
}
```

## API Endpoints for Retrieving Credentials

### 1. Get Current User's GitHub Credentials

**Endpoint:** `GET /github/credentials`
- **Authentication:** Required (Bearer token or session)
- **Description:** Returns the authenticated user's saved GitHub credentials

**Request:**
```bash
curl -X GET http://localhost:5000/github/credentials \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Success):**
```json
{
  "message": "GitHub credentials retrieved successfully.",
  "hasGitHub": true,
  "credentials": {
    "githubId": "1",
    "username": "octocat",
    "name": "The Octocat",
    "email": "octocat@github.com",
    "avatar": "https://avatars.githubusercontent.com/u/1?v=4",
    "profileUrl": "https://github.com/octocat",
    "bio": "There once was...",
    "authMethod": "github"
  }
}
```

**Response (No GitHub linked):**
```json
{
  "message": "No GitHub credentials found for this user.",
  "hasGitHub": false
}
```

### 2. Get All Users with GitHub Credentials (Admin)

**Endpoint:** `GET /github/users`
- **Authentication:** Required (Bearer token or session)
- **Description:** Lists all users in the database who have GitHub credentials linked

**Request:**
```bash
curl -X GET http://localhost:5000/github/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "message": "GitHub users retrieved successfully.",
  "count": 5,
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "username": "octocat",
      "email": "octocat@github.com",
      "githubId": "1",
      "githubLogin": "octocat",
      "githubName": "The Octocat",
      "authMethod": "github",
      "createdAt": "2023-01-01T12:00:00Z"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "username": "defunkt",
      "email": "chris@github.com",
      "githubId": "2",
      "githubLogin": "defunkt",
      "githubName": "Chris Wanstrath",
      "authMethod": "github",
      "createdAt": "2023-01-02T14:30:00Z"
    }
  ]
}
```

### 3. Lookup User by GitHub ID

**Endpoint:** `GET /github/lookup/:githubId`
- **Authentication:** Not required (public endpoint)
- **Description:** Find a user by their GitHub ID

**Request:**
```bash
curl -X GET http://localhost:5000/github/lookup/1
```

**Response (Found):**
```json
{
  "message": "User found.",
  "found": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "octocat",
    "email": "octocat@github.com",
    "githubId": "1",
    "githubLogin": "octocat",
    "githubName": "The Octocat",
    "githubAvatar": "https://avatars.githubusercontent.com/u/1?v=4",
    "authMethod": "github",
    "createdAt": "2023-01-01T12:00:00Z"
  }
}
```

**Response (Not Found):**
```json
{
  "message": "No user found with this GitHub ID.",
  "found": false
}
```

## Utility Functions for Node.js Code

Location: `server/src/utils/githubCredentials.js`

### Usage Examples

```javascript
const {
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
} = require('./utils/githubCredentials');
```

#### 1. Get User by GitHub ID

```javascript
// Find user by GitHub ID
const user = await getUserByGitHubId('12345');
console.log(user.username); // 'octocat'
```

#### 2. Get User Credentials

```javascript
// Get a user's saved GitHub credentials
const credentials = await getGitHubCredentials(userId);
console.log(credentials);
// Output:
// {
//   githubId: '12345',
//   username: 'octocat',
//   name: 'The Octocat',
//   avatar: 'https://...',
//   authMethod: 'github'
// }
```

#### 3. Link GitHub Account to Existing User

```javascript
// Link GitHub to existing user account
const updatedUser = await linkGitHubAccount(userId, githubProfile);
console.log(updatedUser.githubId); // Now has GitHub ID
```

#### 4. Check if User Has GitHub

```javascript
// Check if user has GitHub linked
const hasGithub = await hasGitHubCredentials(userId);
if (hasGithub) {
  console.log('User has GitHub account linked');
}
```

#### 5. Get All GitHub Users

```javascript
// Get all users with GitHub credentials
const githubUsers = await getAllGitHubUsers({ limit: 50, skip: 0 });
console.log(`Found ${githubUsers.length} GitHub users`);
```

#### 6. Get GitHub Statistics

```javascript
// Get GitHub adoption statistics
const stats = await getGitHubStats();
console.log(stats);
// Output:
// {
//   totalGitHubUsers: 45,
//   totalLocalUsers: 15,
//   totalUsers: 60,
//   percentageGitHub: '75.00'
// }
```

#### 7. Update GitHub Profile

```javascript
// Update user's GitHub profile info
const updated = await updateGitHubProfile(userId, {
  displayName: 'New Name',
  bio: 'New bio'
});
```

#### 8. Unlink GitHub Account

```javascript
// Remove GitHub from user account
const user = await unlinkGitHubAccount(userId);
console.log(user.authMethod); // 'local'
```

## Database Queries

### MongoDB Queries (Direct)

#### Find user by GitHub ID
```javascript
db.users.findOne({ githubId: "12345" })
```

#### Find all GitHub users
```javascript
db.users.find({ githubId: { $exists: true, $ne: null } })
```

#### Count GitHub users
```javascript
db.users.countDocuments({ githubId: { $exists: true, $ne: null } })
```

#### Find users who linked GitHub after a date
```javascript
db.users.find({ 
  githubId: { $exists: true }, 
  createdAt: { $gte: new Date("2023-01-01") }
})
```

#### Get GitHub usernames
```javascript
db.users.find(
  { githubId: { $exists: true } },
  { "githubProfile.login": 1 }
)
```

## Sign-Up Flow with Database

### Step 1: User Initiates GitHub OAuth
```
User clicks "Sign in with GitHub"
↓
Redirected to: GET /auth/github
↓
Passport initiates GitHub authorization flow
```

### Step 2: GitHub Returns Authorization Code
```
User authorizes app on GitHub
↓
GitHub redirects to: GET /auth/github/callback?code=...&state=...
```

### Step 3: Exchange Code for Access Token
```
Passport exchanges code for GitHub access token
↓
Fetches user profile from GitHub API
```

### Step 4: Save/Link User to Database

**Case A: New User**
```javascript
// Create new user with GitHub credentials
const user = await User.create({
  username: profile.username,           // 'octocat'
  email: profile.emails[0].value,       // 'octocat@github.com'
  githubId: profile.id,                 // '12345'
  authMethod: 'github',
  githubProfile: {
    login: profile.username,
    id: profile.id,
    avatar_url: profile.photos[0].value,
    profile_url: profile.profileUrl,
    name: profile.displayName,
    bio: profile.bio
  }
});
// User is now saved in MongoDB and can be fetched later
```

**Case B: Existing Email, New GitHub**
```javascript
// Find existing user by email and link GitHub
const user = await User.findOne({ email: profile.emails[0].value });
user.githubId = profile.id;
user.githubProfile = {...};
user.authMethod = 'github';
await user.save();
// User now has GitHub linked
```

**Case C: Existing GitHub ID**
```javascript
// User already has GitHub linked, just update profile
const user = await User.findOne({ githubId: profile.id });
user.githubProfile = {...};  // Update with latest info
await user.save();
// User profile updated
```

### Step 5: Redirect to Success Page
```
Successful auth
↓
Redirect to: /success.html?source=github
↓
User is now authenticated
```

## Fetching Credentials After Sign-Up

### From Backend Code

```javascript
// Get credentials in a route handler
const credentials = await getGitHubCredentials(req.auth.payload.userId);

if (credentials) {
  console.log(`User ${credentials.username} signed up with GitHub`);
  // Do something with the credentials
}
```

### From Frontend (JavaScript)

```javascript
// Fetch user's GitHub credentials after login
const response = await fetch('/github/credentials', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
if (data.hasGitHub) {
  console.log(`Logged in as: ${data.credentials.username}`);
}
```

## Best Practices

### 1. Always Validate GitHub ID
```javascript
// Don't assume githubId exists
if (user.githubId) {
  // Safe to use GitHub data
}
```

### 2. Use Lean for Read-Only Queries
```javascript
// Faster for just reading data
const users = await User.find({ githubId: { $exists: true } }).lean();
```

### 3. Update Profile Regularly
```javascript
// Keep GitHub profile info fresh
await updateGitHubProfile(userId, githubProfile);
```

### 4. Store Sensitive Data Securely
- Never log GitHub IDs without permission
- Use indexes on `githubId` for performance
- Consider encryption for email in production

### 5. Handle Missing Data Gracefully
```javascript
const avatar = user.githubProfile?.avatar_url || '/default-avatar.png';
const name = user.githubProfile?.name || user.username;
```

## Performance Considerations

### Indexes

MongoDB automatically creates indexes for:
- `email` (unique)
- `githubId` (sparse unique)

### Query Performance

For large databases, consider these indexes:
```javascript
db.users.createIndex({ githubId: 1 })
db.users.createIndex({ "githubProfile.login": 1 })
db.users.createIndex({ createdAt: 1 })
```

### Pagination Example

```javascript
const pageSize = 20;
const page = 2;
const users = await getAllGitHubUsers({ 
  limit: pageSize, 
  skip: (page - 1) * pageSize 
});
```

## Error Handling

```javascript
try {
  const credentials = await getGitHubCredentials(userId);
  if (!credentials) {
    return res.status(404).json({ error: 'GitHub not linked' });
  }
} catch (error) {
  console.error('Database error:', error);
  return res.status(500).json({ error: 'Server error' });
}
```

## Security Considerations

1. **API Keys**: Never store GitHub tokens - they're temporary
2. **Email Privacy**: Email from GitHub profile is sensitive PII
3. **Rate Limiting**: GitHub API has rate limits, cache profile data
4. **Session Security**: Use secure session cookies in production
5. **HTTPS**: Always use HTTPS for OAuth callbacks

## Troubleshooting

### Issue: User not found after GitHub signup
```javascript
// Check if githubId was saved
const user = await User.findById(userId);
console.log(user.githubId); // Should not be null
```

### Issue: Duplicate accounts
```javascript
// Check for existing email before creating
const existing = await getUserByEmail(email);
if (existing) {
  // Link GitHub instead of creating new account
  await linkGitHubAccount(existing._id, githubProfile);
}
```

### Issue: Profile not updating
```javascript
// Ensure githubProfile is being saved
await User.updateOne(
  { _id: userId },
  { $set: { githubProfile: newData } }
);
```
