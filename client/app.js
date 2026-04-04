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

  const configuredBase = window.APP_CONFIG?.API_BASE_URL;
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '');
  }

  const savedBase = localStorage.getItem('API_BASE_URL');
  if (savedBase) {
    return savedBase.replace(/\/$/, '');
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
      setMessage('signup-message', data.message || 'OTP sent.', 'success');
      go(`/otp.html?email=${encodeURIComponent(email)}&purpose=signup`);
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
      setMessage('forgot-message', 'If this email exists, OTP has been sent.', 'success');
      go(`/otp.html?email=${encodeURIComponent(email)}&purpose=reset_password`);
    } catch (error) {
      setMessage('forgot-message', error.message, 'error');
    }
  });
}

function setupOtpVerification() {
  const form = document.getElementById('otp-form');
  if (!form) return;

  const query = params();
  const email = query.get('email') || '';
  const purpose = query.get('purpose') || '';
  const emailTarget = document.getElementById('otp-email');
  if (emailTarget) {
    emailTarget.textContent = email || 'unknown email';
  }

  const resendBtn = document.getElementById('resend-btn');
  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      setMessage('otp-message', '', '');
      try {
        if (purpose === 'signup') {
          await apiPost('/register', { email, resend: true });
        } else if (purpose === 'reset_password') {
          await apiPost('/forgot-password', { email });
        } else {
          throw new Error('Unknown OTP purpose.');
        }
        setMessage('otp-message', 'OTP resent successfully.', 'success');
      } catch (error) {
        setMessage('otp-message', error.message, 'error');
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('otp-message', '', '');

    const otp = document.getElementById('otp').value.trim();
    if (!/^\d{6}$/.test(otp)) {
      return setMessage('otp-message', 'OTP must be exactly 6 digits.', 'error');
    }

    try {
      const data = await apiPost('/verify-otp', { email, otp, purpose });

      if (purpose === 'signup') {
        go('/success.html?type=signup');
        return;
      }

      if (purpose === 'reset_password') {
        localStorage.setItem('resetToken', data.resetToken);
        go(`/reset-password.html?email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      setMessage('otp-message', error.message, 'error');
    }
  });
}

function setupResetPassword() {
  const form = document.getElementById('reset-form');
  if (!form) return;

  const query = params();
  const email = query.get('email') || '';
  const emailTarget = document.getElementById('reset-email');
  if (emailTarget) {
    emailTarget.textContent = email || 'unknown email';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('reset-message', '', '');

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const resetToken = localStorage.getItem('resetToken');

    if (!resetToken) {
      return setMessage('reset-message', 'Reset session expired. Restart forgot password flow.', 'error');
    }

    if (!isStrongPassword(password)) {
      return setMessage('reset-message', 'Password must include upper, lower, number, symbol and be 8+ chars.', 'error');
    }

    if (password !== confirmPassword) {
      return setMessage('reset-message', 'Passwords do not match.', 'error');
    }

    try {
      await apiPost('/reset-password', { email, resetToken, password, confirmPassword });
      localStorage.removeItem('resetToken');
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
    detail.textContent = 'Your email has been verified and your account is now active.';
  } else if (type === 'login') {
    heading.textContent = 'Successfully logged in';
    detail.textContent = 'Welcome back. Your login was validated securely.';
  } else if (type === 'reset') {
    heading.textContent = 'Password updated';
    detail.textContent = 'Your password has been reset successfully. You can now log in with it.';
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
