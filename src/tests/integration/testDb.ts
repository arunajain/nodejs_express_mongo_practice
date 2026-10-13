import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Starts a throwaway MongoDB in memory for integration tests.
 * The developer's real database is never touched.
 * The first run downloads a mongod binary, which can take a while.
 */
let mongod: MongoMemoryServer | undefined;

export async function connectTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

// Empties every collection so each test starts from a clean state
export async function clearTestDb(): Promise<void> {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}
