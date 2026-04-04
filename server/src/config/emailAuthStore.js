const fs = require('fs/promises');
const path = require('path');

const EMPTY_STORE = {
  users: [],
  pendingSignups: [],
  passwordResets: []
};

function isGitHubApiMode() {
  return String(process.env.GITHUB_DB_MODE || '').toLowerCase() === 'api';
}

function getLocalStorePath() {
  return process.env.EMAIL_AUTH_FILE_DB_PATH || path.join(__dirname, '..', '..', 'data', 'email-auth.json');
}

function getGitHubDbConfig() {
  return {
    owner: process.env.GITHUB_DB_OWNER,
    repo: process.env.GITHUB_DB_REPO,
    branch: process.env.GITHUB_DB_BRANCH || 'main',
    filePath: process.env.GITHUB_DB_EMAIL_FILE_PATH || 'server/data/email-auth.json',
    token: process.env.GITHUB_DB_TOKEN,
    committerName: process.env.GITHUB_DB_COMMITTER_NAME || 'Auth App Bot',
    committerEmail: process.env.GITHUB_DB_COMMITTER_EMAIL || 'noreply@example.com'
  };
}

function encodeGitHubPath(filePath) {
  return String(filePath || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function githubApiRequest(url, options = {}) {
  const cfg = getGitHubDbConfig();
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cfg.token}`,
    'User-Agent': 'auth-app-email-db',
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = body?.message || `GitHub API request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return body;
}

function normalizeStore(value) {
  return {
    users: Array.isArray(value?.users) ? value.users : [],
    pendingSignups: Array.isArray(value?.pendingSignups) ? value.pendingSignups : [],
    passwordResets: Array.isArray(value?.passwordResets) ? value.passwordResets : []
  };
}

async function readStoreFromGitHub() {
  const cfg = getGitHubDbConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('Missing GitHub DB env vars: GITHUB_DB_OWNER, GITHUB_DB_REPO, GITHUB_DB_TOKEN');
  }

  const encodedPath = encodeGitHubPath(cfg.filePath);
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodedPath}?ref=${encodeURIComponent(cfg.branch)}`;

  try {
    const payload = await githubApiRequest(url, { method: 'GET' });
    const decoded = Buffer.from(String(payload.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return { store: normalizeStore(parsed), sha: payload.sha || null };
  } catch (error) {
    if (error.status === 404) {
      return { store: normalizeStore(EMPTY_STORE), sha: null };
    }
    throw error;
  }
}

async function writeStoreToGitHub(store, currentSha) {
  const cfg = getGitHubDbConfig();
  const encodedPath = encodeGitHubPath(cfg.filePath);
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodedPath}`;
  const content = Buffer.from(JSON.stringify(normalizeStore(store), null, 2), 'utf8').toString('base64');

  const payload = {
    message: 'chore(auth): update email auth store',
    content,
    branch: cfg.branch,
    committer: {
      name: cfg.committerName,
      email: cfg.committerEmail
    }
  };

  if (currentSha) {
    payload.sha = currentSha;
  }

  await githubApiRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function ensureLocalStore() {
  const storePath = getLocalStorePath();
  const dir = path.dirname(storePath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }

  return storePath;
}

async function readStoreFromFile() {
  const storePath = await ensureLocalStore();
  const raw = await fs.readFile(storePath, 'utf8');

  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return normalizeStore(EMPTY_STORE);
  }
}

async function writeStoreToFile(store) {
  const storePath = await ensureLocalStore();
  await fs.writeFile(storePath, JSON.stringify(normalizeStore(store), null, 2), 'utf8');
}

async function readStoreWithMeta() {
  if (isGitHubApiMode()) {
    return readStoreFromGitHub();
  }

  return {
    store: await readStoreFromFile(),
    sha: null
  };
}

async function readStore() {
  const { store } = await readStoreWithMeta();
  return store;
}

async function writeStore(store) {
  if (isGitHubApiMode()) {
    const current = await readStoreFromGitHub();
    await writeStoreToGitHub(store, current.sha);
    return;
  }

  await writeStoreToFile(store);
}

module.exports = {
  readStore,
  writeStore
};
