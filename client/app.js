function setMessage(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
}

function getApiBaseFromQuery() {
  const q = new URLSearchParams(window.location.search);
  const apiBase = q.get('apiBase');
  return apiBase ? apiBase.trim() : '';
}

function getApiBaseUrl() {
  const fromQuery = getApiBaseFromQuery();
  if (fromQuery) {
    localStorage.setItem('API_BASE_URL', fromQuery.replace(/\/$/, ''));
    return fromQuery.replace(/\/$/, '');
  }

  const savedBase = localStorage.getItem('API_BASE_URL');
  if (savedBase) {
    const normalizedSaved = savedBase.replace(/\/$/, '');
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const savedLooksRemote = /^https?:\/\/(?!localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)/i.test(normalizedSaved);

    if (!(isLocalHost && savedLooksRemote)) {
      return normalizedSaved;
    }
  }

  const configuredBase = window.APP_CONFIG?.API_BASE_URL;
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '');
  }

  return window.location.origin;
}

function normalizeBase(base) {
  return String(base || '').trim().replace(/\/$/, '');
}

function getApiBaseCandidates() {
  const primary = normalizeBase(getApiBaseUrl());
  const origin = normalizeBase(window.location.origin);
  const candidates = [primary];

  // Common production setup: frontend on root, backend behind /api
  if (!/\/api$/i.test(primary)) {
    candidates.push(`${primary}/api`);
  } else {
    // If user saved .../api as base, keep a root fallback too.
    candidates.push(primary.replace(/\/api$/i, ''));
  }

  // Always include current origin variants as a fallback.
  if (origin && !candidates.includes(origin)) {
    candidates.push(origin);
  }
  if (origin && !candidates.includes(`${origin}/api`)) {
    candidates.push(`${origin}/api`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function buildApiUrl(base, path) {
  if (!path.startsWith('/')) {
    return `${base}/${path}`;
  }

  if (/\/api$/i.test(base)) {
    return `${base}${path}`;
  }

  return `${base}${path}`;
}

async function apiPost(url, payload) {
  const liveProvider = window.LiveAuthProvider;
  if (liveProvider?.enabled && typeof liveProvider.post === 'function') {
    return await liveProvider.post(url, payload);
  }

  const bases = url.startsWith('http') ? [''] : getApiBaseCandidates();
  let lastError = null;

  for (const base of bases) {
    const apiUrl = url.startsWith('http') ? url : buildApiUrl(base, url);

    let res;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      lastError = new Error(`Unable to reach the authentication API at ${base || getApiBaseUrl()}. ${error.message}`);
      continue;
    }

    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();
    let data = {};
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(raw || '{}');
      } catch {
        data = {};
      }
    }

    if (res.ok) {
      return data;
    }

    const textFallback = raw && !contentType.includes('application/json')
      ? raw.slice(0, 140).replace(/\s+/g, ' ')
      : '';

    const detail =
      data.message ||
      (res.status === 404 ? 'API endpoint not found. Check backend deployment.' : '') ||
      (res.status === 405
        ? 'API is not available on this domain. Deploy backend API and set APP_CONFIG.API_BASE_URL to that server URL.'
        : '') ||
      textFallback ||
      `HTTP ${res.status}`;

    // If root path returns a common proxy/static error, try next candidate (/api).
    const isRetryable = [404, 405, 502, 503].includes(res.status);
    if (isRetryable && base === getApiBaseUrl() && bases.length > 1) {
      lastError = new Error(detail);
      continue;
    }

    throw new Error(detail);
  }

  throw lastError || new Error('Request failed');
}

function isStrongPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(value);
}

function go(path) {
  window.location.href = path.replace(/^\//, '');
}

function params() {
  return new URLSearchParams(window.location.search);
}

function setupLanding() {
  const loginBtn = document.getElementById('go-login');
  const signupBtn = document.getElementById('go-signup');
  const forgotLink = document.getElementById('go-forgot');

  if (loginBtn) loginBtn.addEventListener('click', () => go('/login.html'));
  if (signupBtn) signupBtn.addEventListener('click', () => go('/signup.html'));
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      go('/forgot-password.html');
    });
  }
}

function setupSignup() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('signup-message', '', '');

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!username || username.length < 3) {
      return setMessage('signup-message', 'Username must be at least 3 characters.', 'error');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return setMessage('signup-message', 'Enter a valid email.', 'error');
    }
    if (!isStrongPassword(password)) {
      return setMessage('signup-message', 'Password must include upper, lower, number, symbol and be 8+ chars.', 'error');
    }
    if (password !== confirmPassword) {
      return setMessage('signup-message', 'Passwords do not match.', 'error');
    }

    try {
      const data = await apiPost('/register', { username, email, password, confirmPassword });
      setMessage('signup-message', data.message || 'Verification email sent.', 'success');
      go(`/otp.html?email=${encodeURIComponent(email)}&purpose=verifyEmail`);
    } catch (error) {
      setMessage('signup-message', error.message, 'error');
    }
  });
}

function setupLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('login-message', '', '');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await apiPost('/login', { email, password });
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      go('/success.html?type=login');
    } catch (error) {
      setMessage('login-message', error.message, 'error');
    }
  });
}

function setupForgotPassword() {
  const form = document.getElementById('forgot-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('forgot-message', '', '');

    const email = document.getElementById('email').value.trim();

    try {
      await apiPost('/forgot-password', { email });
      setMessage('forgot-message', 'If this email exists, a reset link has been sent.', 'success');
    } catch (error) {
      setMessage('forgot-message', error.message, 'error');
    }
  });
}

function setupOtpVerification() {
  const query = params();
  const oobCode = query.get('oobCode') || '';
  const mode = query.get('mode') || query.get('purpose') || '';
  const email = query.get('email') || '';
  const detailTarget = document.getElementById('otp-detail');
  const titleTarget = document.getElementById('otp-title');
  const resendBtn = document.getElementById('resend-btn');

  if (titleTarget) {
    titleTarget.textContent = 'Verify your email';
  }

  if (detailTarget) {
    detailTarget.textContent = oobCode
      ? 'Verifying your email now.'
      : 'Check your inbox and click the verification link to activate your account.';
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      setMessage('otp-message', '', '');
      try {
        await apiPost('/verify-otp', { resend: true, email });
        setMessage('otp-message', 'Verification email sent again.', 'success');
      } catch (error) {
        setMessage('otp-message', error.message, 'error');
      }
    });
  }

  if (oobCode && mode === 'verifyEmail') {
    setMessage('otp-message', '', '');
    apiPost('/verify-otp', { oobCode })
      .then(() => {
        go('/success.html?type=verify-email');
      })
      .catch((error) => {
        setMessage('otp-message', error.message, 'error');
      });
  }
}

function setupResetPassword() {
  const form = document.getElementById('reset-form');
  if (!form) return;

  const query = params();
  const oobCode = query.get('oobCode') || '';
  const email = query.get('email') || '';
  const emailTarget = document.getElementById('reset-email');
  if (emailTarget) {
    emailTarget.textContent = email || 'your email';
  }

  const resetHint = document.getElementById('reset-hint');
  if (resetHint) {
    resetHint.textContent = oobCode
      ? 'Set a new password for your account.'
      : 'Open the password reset link from your email to continue.';
  }

  if (oobCode) {
    apiPost('/verify-reset-code', { oobCode })
      .then((data) => {
        if (emailTarget && data.email) {
          emailTarget.textContent = data.email;
        }
      })
      .catch((error) => {
        setMessage('reset-message', error.message, 'error');
      });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('reset-message', '', '');

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (!oobCode) {
      return setMessage('reset-message', 'Open the password reset link from your email to continue.', 'error');
    }

    if (!isStrongPassword(password)) {
      return setMessage('reset-message', 'Password must include upper, lower, number, symbol and be 8+ chars.', 'error');
    }

    if (password !== confirmPassword) {
      return setMessage('reset-message', 'Passwords do not match.', 'error');
    }

    try {
      await apiPost('/reset-password', { oobCode, password, confirmPassword });
      go('/success.html?type=reset');
    } catch (error) {
      setMessage('reset-message', error.message, 'error');
    }
  });
}

function setupSuccess() {
  const q = params();
  const type = q.get('type');
  const heading = document.getElementById('success-title');
  const detail = document.getElementById('success-detail');

  if (!heading || !detail) return;

  if (type === 'signup') {
    heading.textContent = 'Signup completed';
    detail.textContent = 'Your account was created. Check your email to verify it.';
  } else if (type === 'login') {
    heading.textContent = 'Successfully logged in';
    detail.textContent = 'Welcome back. Your login was validated securely.';
  } else if (type === 'reset') {
    heading.textContent = 'Password updated';
    detail.textContent = 'Your password has been reset successfully. You can now log in with it.';
  } else if (type === 'reset-email') {
    heading.textContent = 'Reset email sent';
    detail.textContent = 'If the account exists, a password reset link was sent to your email.';
  } else if (type === 'verify-email') {
    heading.textContent = 'Verification email sent';
    detail.textContent = 'Check your inbox and click the verification link to activate your account.';
  } else {
    heading.textContent = 'Success';
    detail.textContent = 'Operation completed successfully.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'landing') setupLanding();
  if (page === 'signup') setupSignup();
  if (page === 'login') setupLogin();
  if (page === 'forgot') setupForgotPassword();
  if (page === 'otp') setupOtpVerification();
  if (page === 'reset') setupResetPassword();
  if (page === 'success') setupSuccess();
});
