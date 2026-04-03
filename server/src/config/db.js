const mongoose = require('mongoose');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      await mongoose.connect(mongoUri, {
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
    `MongoDB connection failed after ${maxRetries} attempts. Last error: ${lastError ? lastError.message : 'Unknown error'}`
  );
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase, getDatabaseStatus };
