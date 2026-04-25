window.APP_CONFIG = window.APP_CONFIG || {};

// Set this to your public site URL. The app will try both /register and /api/register styles.
// Example:
//   http://nexl.me
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
window.APP_CONFIG.API_BASE_URL =
	window.APP_CONFIG.API_BASE_URL ||
	(isLocalHost ? 'http://localhost:3000' : window.location.origin);

// Firebase live DB mode for browser-side auth flow.
window.APP_CONFIG.ENABLE_FIREBASE_LIVE_PROVIDER =
	window.APP_CONFIG.ENABLE_FIREBASE_LIVE_PROVIDER !== undefined
		? window.APP_CONFIG.ENABLE_FIREBASE_LIVE_PROVIDER
		: true;

// Keep false in production to avoid exposing OTP in UI messages.
window.APP_CONFIG.SHOW_DEV_OTP =
	window.APP_CONFIG.SHOW_DEV_OTP !== undefined
		? window.APP_CONFIG.SHOW_DEV_OTP
		: false;
