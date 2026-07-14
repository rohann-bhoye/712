import { MongoClient, MongoClientOptions, Db } from 'mongodb';
import logger from './logger';
import dns from 'dns';

// Fix DNS resolution issues on Windows local environment for MongoDB Atlas SRV
if (process.platform === "win32") {
  try {
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
  } catch (e) {
    console.warn("[MongoDB DNS Fix] Could not set Google DNS servers:", e);
  }
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'bucketdev';

if (!uri) {
  throw new Error('MONGODB_URI is not set. Add it to .env.local (dev) or your deployment env vars (prod).');
}

// Production-hardened options for MongoDB Atlas:
// - TLS enforced, server certificate validation enabled
// - Automatic server selection and socket timeouts to prevent hanging connections
// - Connection pool sized for serverless/short-lived Next.js API routes
const clientOptions: MongoClientOptions = {
  serverSelectionTimeoutMS: 5000,   // Fail fast if cluster unreachable
  socketTimeoutMS: 45000,           // Give long-running queries reasonable time
  connectTimeoutMS: 10000,          // Initial connection timeout
  maxPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
  retryWrites: true,
  retryReads: true
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In dev, reuse the global connection across hot-reloads to avoid pool exhaustion
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    globalWithMongo._mongoClientPromise = client.connect().then(c => {
      logger.info('MongoDB connected (development mode)');
      return c;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production, create a fresh client per cold start
  client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect().then(c => {
    logger.info('MongoDB connected (production mode)');
    return c;
  });
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  try {
    const clientConnection = await clientPromise;
    const db = clientConnection.db(dbName);
    return { client: clientConnection, db };
  } catch (error: any) {
    logger.error('MongoDB connection failed', { message: error.message, uri: uri?.replace(/\/\/.*@/, '//<credentials>@') });
    throw error;
  }
}

export default clientPromise;
