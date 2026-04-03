# Full-Stack Authentication Website (Node.js + Express + MongoDB + SMTP OTP)

This workspace now also includes a complete authentication website:

- Frontend pages in `client/`
- Backend API in `server/`
- Real SMTP OTP for signup and password reset
- Password hashing with bcrypt
- JWT login tokens
- OTP expiry + resend + rate limiting

## API Routes

- `POST /register`
- `POST /verify-otp`
- `POST /login`
- `POST /forgot-password`
- `POST /reset-password`

## Setup

1. Copy `server/.env.example` to `server/.env`
2. Fill values for MongoDB and SMTP

Required environment variables:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/auth_smtp_app
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=1d
RESET_TOKEN_EXPIRES_IN=10m

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Auth App <no-reply@example.com>"
```

## Run

From `server/`:

```powershell
cmd /c npm install
cmd /c npm run dev
```

Open:

- `http://localhost:5000/` for landing page
- `http://localhost:5000/health` for API health check

## Security implemented

- Password hashing with bcrypt
- Duplicate email prevention
- OTP expiry (5 minutes)
- OTP request cooldown and rate limiting
- OTP never sent to frontend responses
- JWT tokens for login and password reset authorization
- Session tracking with MongoDB and JWT token IDs
- Audit logs for signup, login, logout, and reset activity
- MongoDB-backed user profiles and settings

## MongoDB collections added

- `users` for permanent accounts
- `pending_signups` for verification flow state
- `otp_codes` for password reset codes
- `sessions` for active login sessions with TTL cleanup
- `audit_logs` for security and activity history
- `user_profiles` for display names, preferences, and contact details

## Profile API

- `GET /profile` returns the current user and profile document
- `PUT /profile` updates profile fields like display name, theme, bio, and contact details

## Go Live With MongoDB Atlas

1. Create a MongoDB Atlas cluster (M0 is fine to start).
2. Create a dedicated database user with read/write permission.
3. In Atlas Network Access, allow your server egress IP (or temporary `0.0.0.0/0` during setup).
4. Copy `server/.env.production.example` to `server/.env` and fill all placeholders.
5. Set `MONGO_URI` to your Atlas SRV string, including your app database name.
6. Set a strong `JWT_SECRET` (at least 32 random characters).
7. Set `CORS_ORIGIN` to your real frontend domains only.
8. Start backend from `server/` with `npm start`.
9. Validate health endpoint: `GET /health` should return `ok: true` and `dbStatus: connected`.

Example production URI format:

```env
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster-host>/auth_smtp_app?retryWrites=true&w=majority&appName=auth-smtp-app
```
