// GitHub OAuth Only - Simplified Client

function setMessage(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
}

function params() {
  return new URLSearchParams(window.location.search);
}

function setupLogin() {
  const query = params();
  const oauthError = query.get('error');
  if (oauthError === 'github_auth_failed') {
    setMessage('login-message', 'GitHub sign-in failed. Please try again.', 'error');
  }
}

function setupSuccess() {
  const q = params();
  const type = q.get('type');
  const source = q.get('source');
  const heading = document.getElementById('success-title');
  const detail = document.getElementById('success-detail');

  if (!heading || !detail) return;

  if (source === 'github') {
    heading.textContent = 'GitHub Sign-In Complete';
    detail.textContent = 'Your GitHub account is now authenticated. Welcome!';
  } else {
    heading.textContent = 'Success';
    detail.textContent = 'You have been successfully signed in.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'login') setupLogin();
  if (page === 'success') setupSuccess();
});
