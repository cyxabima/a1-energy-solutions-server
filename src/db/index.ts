import { type ClientSession, type Db, MongoClient } from "mongodb";
import { config } from "../config/index.js";

let client: MongoClient;
let db: Db;

export async function connectDB(): Promise<Db> {
	if (db) return db;

	client = new MongoClient(config.mongodbUri);
	await client.connect();
	db = client.db();

	console.log(`Connected to MongoDB: ${db.databaseName}`);
	return db;
}

export function getDb(): Db {
	if (!db) {
		throw new Error("Database not initialized. Call connectDB() first.");
	}
	return db;
}

export async function withTransaction<T>(
	fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
	if (!client) {
		throw new Error("Database not initialized. Call connectDB() first.");
	}
	const session = client.startSession();
	try {
		return await session.withTransaction(async () => fn(session));
	} finally {
		await session.endSession();
	}
}

export async function closeDB(): Promise<void> {
	if (client) {
		await client.close();
		console.log("MongoDB connection closed");
	}
}
