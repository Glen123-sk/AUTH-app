# GitHub OAuth Authentication App

This project is now a GitHub OAuth-only authentication app.

- Frontend pages are in `client/`
- Backend server is in `server/`
- User records are persisted in a local JSON file store (`server/data/github-users.json`)
- No database driver is required

## Main Endpoints

- `GET /auth/github` starts GitHub login
- `GET /auth/github/callback` OAuth callback
- `GET /auth/github/user` returns the authenticated user session
- `GET /health` service health

The legacy email/password + OTP endpoints (`/register`, `/login`, etc.) return `410` because they were removed.

## Deployment

For production deployment to your domain:

1. Copy `server/.env.production.example` to your hosting platform's environment variables
2. Update the values:
   - `GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback`
   - `CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com`
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from your GitHub OAuth app
   - `JWT_SECRET` with a strong random value

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
- `GET /auth/github` returns redirect (`302`) to GitHub
