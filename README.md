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

## Setup

1. Copy `server/.env.example` to `server/.env`
2. Fill GitHub OAuth values

Required environment variables:

```env
PORT=5000
NODE_ENV=development
TRUST_PROXY=true
USE_GITHUB_AUTH_ONLY=true
JWT_SECRET=replace_with_long_random_secret
CORS_ORIGIN=http://localhost:5000,http://127.0.0.1:5000

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/auth/github/callback
GITHUB_FILE_DB_PATH=
```

## Run

From `server/`:

```powershell
npm install
npm run dev
```

Open `http://localhost:5000/`.

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
