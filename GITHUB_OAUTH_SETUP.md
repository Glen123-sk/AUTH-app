# GitHub OAuth Setup Guide

This guide explains how to set up GitHub OAuth authentication for your Node.js/Express application.

## Prerequisites

- A GitHub account
- The application already has Passport.js and passport-github2 installed
- Your application is running on a specific URL (local or production)

## Step 1: Register a GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click on **OAuth Apps** in the left sidebar
3. Click the **New OAuth App** button
4. Fill in the application details:

   - **Application name**: Your app name (e.g., "My Auth App")
   - **Homepage URL**: `https://yourdomain.com`
   - **Application description**: Optional description
   - **Authorization callback URL**: `https://yourdomain.com/auth/github/callback`

5. Click **Register application**

## Step 2: Get Your Credentials

After creating the OAuth app:

1. You'll see your **Client ID** displayed on the app page
2. Click **Generate a new client secret**
3. Copy the generated **Client Secret** (it will only be shown once!)

## Step 3: Configure Environment Variables

1. Copy or create `.env` in the `server/` directory from `.env.production.example`:

   ```bash
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   GITHUB_CALLBACK_URL=https://yourdomain.com/auth/github/callback
   ```

   Replace `yourdomain.com` with your actual production domain and fill in your GitHub credentials.

2. Make sure your `.env` file is in the `server/` directory and is **not** committed to version control

## Step 4: Deploy and Test

1. Deploy your application to your production server

2. Visit: `https://yourdomain.com/auth/github`

3. You should be redirected to GitHub to authorize the application

4. After authorization, you'll be redirected back to your app at `https://yourdomain.com/success.html`

## GitHub Config Output

The console will display whether GitHub OAuth is configured:
- ✅ If configured properly: "GitHub OAuth is ready"
- ⚠️ If missing credentials: "GitHub OAuth not fully configured. Missing: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET"

## Frontend Integration

To add a "Sign in with GitHub" button in your frontend:

```html
<a href="/auth/github" class="btn btn-github">
  Sign in with GitHub
</a>
```

## User Data Returned from GitHub

When a user successfully authenticates via GitHub, the following data is stored:

```javascript
{
  username: "github_username",
  email: "user@example.com",
  githubId: 123456789,
  authMethod: "github",
  githubProfile: {
    login: "github_username",
    id: 123456789,
    avatar_url: "https://avatars.githubusercontent.com/u/...",
    profile_url: "https://github.com/...",
    name: "User Full Name",
    bio: "User bio, if provided"
  }
}
```

## Endpoints

### Initiate GitHub OAuth
- **GET** `/auth/github`
  - Redirects to GitHub authorization
  - Scopes: `user:email`, `user`

### GitHub OAuth Callback
- **GET** `/auth/github/callback`
  - Handled by Passport.js automatically
  - Redirects to `/success.html?source=github` on success
  - Redirects to `/login?error=github_auth_failed` on failure

### Get Current GitHub User Info
- **GET** `/auth/github/user`
  - Returns current authenticated user if logged in via GitHub
  - Requires session authentication
  - Response:
    ```json
    {
      "user": {
        "id": "...",
        "username": "...",
        "email": "...",
        "githubId": "...",
        "githubProfile": {...},
        "authMethod": "github"
      }
    }
    ```

## Troubleshooting

### "Invalid client ID" Error
- Double-check that `GITHUB_CLIENT_ID` matches the value from GitHub settings
- Make sure you've copied the entire ID

### "Invalid client secret"
- Verify `GITHUB_CLIENT_SECRET` is correct
- If you forgot the secret, generate a new one from GitHub settings

### Callback URL mismatch
- The URL you register on GitHub must exactly match `GITHUB_CALLBACK_URL` in your `.env`
- Common issue: `http://` vs `https://`, or missing trailing slash

### Session not persisting
- Ensure `express-session` middleware is initialized before `passport.session()`
- Check that `JWT_SECRET` is set (used as session secret)

### CORS Issues
- Ensure your frontend domain is in the `CORS_ORIGIN` environment variable

## Linking GitHub to Existing Accounts

If a user already has an account and logs in via GitHub:
1. First, they must authenticate via their existing method (email/password)
2. Then, if they want to link GitHub, they can authorize GitHub OAuth
3. The system will automatically link the GitHub account to their existing user profile

Alternatively, if a GitHub user with a matching email logs in for the first time, the system will link to the existing account automatically.

## Session Management

- GitHub sessions are stored server-side using `express-session`
- Session cookies expire after 24 hours by default
- User records are persisted to a local JSON datastore

## Security Considerations

1. **Never commit `.env`** to version control
2. **Regenerate secrets** if they're accidentally exposed
3. **Use HTTPS** in production (`GITHUB_CALLBACK_URL` should use `https://`)
4. **Validate scopes** - only request the minimum required permissions
5. **Session timeout** - sessions expire for security

## Deployment Checklist

Before deploying:

1. ✅ Verify `GITHUB_CALLBACK_URL` matches your domain exactly:
   ```
   GITHUB_CALLBACK_URL=https://yourdomain.com/auth/github/callback
   ```

2. ✅ Verify GitHub OAuth app settings:
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `https://yourdomain.com/auth/github/callback`

3. ✅ Set `NODE_ENV=production` in your deployment environment

4. ✅ Enable HTTPS (all traffic must be encrypted)

5. ✅ Set a strong `JWT_SECRET` value

6. ✅ Verify user data persistence (file-based storage by default)

## Additional Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Passport.js GitHub Strategy](http://www.passportjs.org/packages/passport-github2/)
- [Express Session Middleware](https://github.com/expressjs/session)
