const mongoose = require('mongoose');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMongoUri(mongoUri) {
  const trimmedUri = String(mongoUri || '').trim();

  try {
    const parsedUri = new URL(trimmedUri);

    if (parsedUri.username || parsedUri.password) {
      parsedUri.username = parsedUri.username;
      parsedUri.password = parsedUri.password;
    }

    return parsedUri.toString();
  } catch {
    return trimmedUri;
  }
}

function buildConnectionError(error) {
  const message = error && error.message ? error.message : 'Unknown error';

  if (/bad auth|authentication failed/i.test(message)) {
    return new Error(
      `MongoDB authentication failed. Check the username and password in MONGO_URI, URL-encode any special characters in the password, and confirm authSource if the user was created in a different database. Original error: ${message}`
    );
  }

  return new Error(message);
}

function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return states[mongoose.connection.readyState] || 'unknown';
}

async function connectDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured.');
  }

  const normalizedMongoUri = normalizeMongoUri(mongoUri);

  const maxRetries = Number(process.env.MONGO_CONNECT_RETRIES || 5);
  const retryDelayMs = Number(process.env.MONGO_CONNECT_RETRY_DELAY_MS || 3000);
  const serverSelectionTimeoutMS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB error: ${error.message}`);
  });

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(normalizedMongoUri, {
        serverSelectionTimeoutMS,
        autoIndex: process.env.NODE_ENV !== 'production'
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.warn(
          `MongoDB connection attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${retryDelayMs}ms...`
        );
        await wait(retryDelayMs);
      }
    }
  }

  throw new Error(
    `MongoDB connection failed after ${maxRetries} attempts. Last error: ${buildConnectionError(lastError).message}`
  );
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase, getDatabaseStatus };
