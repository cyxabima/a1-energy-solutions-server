import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export const config = {
	port: Number(process.env.PORT) || 8000,
	nodeEnv: process.env.NODE_ENV || "development",
	mongodbUri: requireEnv("MONGODB_URI"),
	secret: requireEnv("SECRET"),
} as const;
