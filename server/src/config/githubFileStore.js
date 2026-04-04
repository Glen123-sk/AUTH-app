const fs = require('fs/promises');
const path = require('path');

function getStorePath() {
  return process.env.GITHUB_FILE_DB_PATH || path.join(__dirname, '..', '..', 'data', 'github-users.json');
}

async function ensureStoreFile() {
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(storePath);
  } catch {
    const initial = { users: [] };
    await fs.writeFile(storePath, JSON.stringify(initial, null, 2), 'utf-8');
  }

  return storePath;
}

async function readStore() {
  const storePath = await ensureStoreFile();
  const raw = await fs.readFile(storePath, 'utf-8');

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.users)) {
      return { users: [] };
    }
    return parsed;
  } catch {
    return { users: [] };
  }
}

async function writeStore(store) {
  const storePath = await ensureStoreFile();
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

async function upsertGithubUser(user) {
  const store = await readStore();
  const githubId = String(user.githubId || user.id || '');

  if (!githubId) {
    throw new Error('Cannot persist GitHub user without githubId.');
  }

  const now = new Date().toISOString();
  const normalized = {
    id: githubId,
    githubId,
    username: user.username || '',
    email: user.email || `${user.username || 'github_user'}@github.local`,
    githubProfile: user.githubProfile || null,
    authMethod: 'github',
    updatedAt: now
  };

  const existingIndex = store.users.findIndex((entry) => String(entry.githubId) === githubId);
  if (existingIndex >= 0) {
    const existing = store.users[existingIndex];
    store.users[existingIndex] = {
      ...existing,
      ...normalized,
      createdAt: existing.createdAt || now
    };
  } else {
    store.users.push({
      ...normalized,
      createdAt: now
    });
  }

  await writeStore(store);
  return store.users.find((entry) => String(entry.githubId) === githubId) || normalized;
}

async function findGithubUserById(githubId) {
  const store = await readStore();
  return store.users.find((entry) => String(entry.githubId) === String(githubId)) || null;
}

module.exports = {
  getStorePath,
  upsertGithubUser,
  findGithubUserById
};
