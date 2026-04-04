# Project Handoff Note

This project is a full-stack authentication app.

## Main Entry Points
- Root landing page: `index.html`
- Frontend files: `client/`
- Frontend logic: `client/app.js`
- Backend entry: `server/src/app.js`
- Auth routes: `server/src/routes/authRoutes.js`
- MongoDB models: `server/src/models/`
- Shared auth helpers: `server/src/utils/auth.js`
- SMTP mail helper: `server/src/config/mailer.js`
- MongoDB connection helper: `server/src/config/db.js`

## How The App Is Wired
- The browser opens `index.html`, which redirects to `http://localhost:5000/`.
- Express in `server/src/app.js` serves the static frontend from `client/`.
- The same server mounts all auth endpoints under `/`.
- `client/app.js` detects the current page and attaches the correct event handlers.
- The frontend calls the backend with `fetch` requests to `/register`, `/verify-otp`, `/login`, `/forgot-password`, and `/reset-password`.
- The backend stores users, OTPs, sessions, and audit records in MongoDB.
- OTP emails are sent through nodemailer in `server/src/config/mailer.js`.

## Frontend Flow
- `client/index.html`: landing page with navigation buttons.
- `client/signup.html`: user signup form.
- `client/login.html`: login form.
- `client/forgot-password.html`: starts password reset.
- `client/otp.html`: OTP verification page used for signup and reset.
- `client/reset-password.html`: final password reset form.
- `client/success.html`: success screen after signup, login, or reset.

## Backend Flow
- `server/src/app.js` loads environment variables, connects to MongoDB, creates the mail transporter, configures CORS, serves static files, and starts the HTTP server.
- `server/src/routes/authRoutes.js` contains the actual business logic for signup, login, OTP verification, password reset, logout, and profile/session endpoints.
- `server/src/config/db.js` manages the MongoDB connection and connection status.
- `server/src/config/mailer.js` builds the SMTP transporter and sends OTP emails.
- `server/src/utils/auth.js` holds shared auth utilities like password hashing, OTP generation, JWT creation, and token verification.

## Data Models
- `server/src/models/User.js`: permanent account record.
- `server/src/models/PendingSignup.js`: temporary signup state before OTP verification.
- `server/src/models/OtpCode.js`: reset-password OTP records.
- `server/src/models/Session.js`: active login sessions.
- `server/src/models/AuditLog.js`: security and activity audit history.
- `server/src/models/UserProfile.js`: profile and settings data.

## Main Request Flows
### Signup
1. User submits the form in `client/signup.html`.
2. `client/app.js` sends `POST /register`.
3. The server validates input and stores a pending signup record.
4. The server sends an OTP email.
5. The user enters the OTP on `client/otp.html`.
6. `client/app.js` sends `POST /verify-otp`.
7. The server creates the user and profile records and removes the pending signup.

### Login
1. User submits the form in `client/login.html`.
2. `client/app.js` sends `POST /login`.
3. The server checks the user against `User.js` and creates a session.
4. The frontend stores the token and user data in `localStorage`.
5. The user is redirected to `client/success.html`.

### Forgot Password
1. User submits `client/forgot-password.html`.
2. `client/app.js` sends `POST /forgot-password`.
3. The server creates an OTP record and emails the code.
4. The user verifies the OTP on `client/otp.html`.
5. The server returns a reset token.
6. The frontend stores the reset token and redirects to `client/reset-password.html`.
7. The new password is sent to `POST /reset-password`.

## Important Assumptions
- The app is meant to run from the backend, not Live Server.
- The site should be opened at `http://localhost:5000/`.
- MongoDB must be running.
- SMTP credentials must be valid for real email delivery.
- Required environment variables include `MONGO_URI`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`.

## When Adding A New Feature
- Add or update the HTML page in `client/`.
- Add the UI logic to `client/app.js`.
- Add the API route in `server/src/routes/authRoutes.js`.
- Add a MongoDB model if the feature needs persistence.
- Add shared validation or token logic to `server/src/utils/auth.js` when appropriate.
- Update `server/src/app.js` only if startup, CORS, static hosting, or shared app wiring needs to change.

## Run Instructions
From `server/`:
- `npm install`
- `npm start`

Then open `http://localhost:5000/`.
