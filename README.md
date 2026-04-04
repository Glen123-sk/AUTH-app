# GitHub OAuth Authentication App

This project supports email/password authentication with SMTP OTP verification, and optional GitHub OAuth sign-in.

- Frontend pages are in `client/`
- Backend server is in `server/`
- User records can be persisted either in a local JSON file or directly in your GitHub repository via GitHub API
- No database driver is required

## Main Endpoints

- `POST /register` starts email signup and sends OTP
- `POST /verify-otp` verifies OTP for signup or password reset
- `POST /login` signs in email users
- `POST /forgot-password` sends reset OTP
- `POST /reset-password` resets password with verified reset token
- `GET /auth/github` starts GitHub login (optional)
- `GET /auth/github/callback` OAuth callback (optional)
- `GET /auth/github/user` returns the authenticated GitHub session
- `GET /health` service health

## Deployment

For production deployment to your domain:

1. Copy `server/.env.production.example` to your hosting platform's environment variables
2. Update the values:
   - `GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback`
   - `CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com`
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from your GitHub OAuth app
   - `JWT_SECRET` with a strong random value
   - `GITHUB_DB_MODE=api`
   - `GITHUB_DB_OWNER`, `GITHUB_DB_REPO`, `GITHUB_DB_BRANCH`, `GITHUB_DB_FILE_PATH`
   - `GITHUB_DB_TOKEN` (GitHub PAT with repo contents write permission)
   - Set `client/config.js` `APP_CONFIG.API_BASE_URL` to the public URL of your Node.js backend if it is separate from the frontend

3. Ensure your GitHub OAuth app settings match:
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL: `https://your-domain.com/auth/github/callback` (exact match)

4. Deploy and verify with `GET https://your-domain.com/health`

## Live Deployment Checklist

1. Set `NODE_ENV=production`
2. Set `TRUST_PROXY=true`
3. Set callback to HTTPS:
   - `GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback`
4. Ensure GitHub OAuth app callback URL exactly matches the env value
5. Set `CORS_ORIGIN` to your live domain(s)

Quick checks:

- `GET /health` returns `ok: true`
- `GET /health` returns `storage: "github-api"` when GitHub API database mode is enabled
- `GET /auth/github` returns redirect (`302`) to GitHub
