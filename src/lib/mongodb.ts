import { config as loadEnv } from "dotenv";
import { MongoClient, type Db } from "mongodb";

loadEnv({ path: ".env.local", quiet: true });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "studypilot";

const globalForMongo = globalThis as typeof globalThis & {
  __studypilotMongoClient?: MongoClient;
  __studypilotMongoDb?: Db;
};

function redactMongoUri(input?: string) {
  if (!input) return input;
  // Keep scheme + host, redact credentials/query where possible
  try {
    const u = new URL(input);
    if (u.username) u.username = "***";
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "***";
  }
}

export async function getMongoDb() {
  if (!uri) {
    const msg = "MONGODB_URI is required. Add it to .env.local.";
    console.error("[mongodb] Missing MONGODB_URI", {
      dbName,
      uri: redactMongoUri(uri),
    });
    throw new Error(msg);
  }

  if (globalForMongo.__studypilotMongoDb) {
    return globalForMongo.__studypilotMongoDb;
  }

  let client = globalForMongo.__studypilotMongoClient;
  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
      });
      await client.connect();
      // Force immediate server selection to surface DNS/network issues early
      await client.db(dbName).command({ ping: 1 });
      globalForMongo.__studypilotMongoClient = client;
    }

    const db = client.db(dbName);
    globalForMongo.__studypilotMongoDb = db;
    return db;
  } catch (err) {
    console.error("[mongodb] Failed to connect/ping MongoDB", {
      dbName,
      uri: redactMongoUri(uri),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Avoid leaking creds; keep message visible to route handler
    throw err instanceof Error ? err : new Error(String(err));
  }
}
