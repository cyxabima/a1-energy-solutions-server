import app from "./app.js";
import { config } from "./config/index.js";
import { closeDB, connectDB } from "./db/index.js";

async function start() {
	try {
		await connectDB();
		app.listen(config.port, () => {
			console.log(`Server running on port ${config.port}`);
		});
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

start();

process.on("SIGINT", async () => {
	await closeDB();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await closeDB();
	process.exit(0);
});
