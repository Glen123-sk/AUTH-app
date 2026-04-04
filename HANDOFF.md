# Project Handoff Note

This project is a GitHub OAuth-only authentication app.

## Main Entry Points
- Root landing page: `index.html`
- Frontend files: `client/`
- Frontend logic: `client/app.js`
- Backend entry: `server/src/app.js`
- GitHub OAuth strategy: `server/src/config/github.js`
- File datastore: `server/src/config/githubFileStore.js`

## How The App Is Wired
- The browser opens `index.html`, which redirects to `http://localhost:5000/`.
- Express in `server/src/app.js` serves static frontend files from `client/`.
- GitHub OAuth starts at `GET /auth/github`.
- Callback is handled by `GET /auth/github/callback`.
- Authenticated user data is stored in `server/data/github-users.json`.
- Session user info is exposed by `GET /auth/github/user`.

## Frontend Notes
- `client/login.html` includes a GitHub sign-in action.
- Legacy email/password forms still exist, but backend endpoints return `410` because those flows were removed.

## Important Assumptions
- App runs from backend, not Live Server.
- Open site at `http://localhost:5000/`.
- GitHub OAuth credentials must be configured in `server/.env`.

## Required Environment Variables
- `JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`

## Run Instructions
From `server/`:
- `npm install`
- `npm start`

Then open `http://localhost:5000/`.
