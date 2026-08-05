import app from "./app.js";
import { config } from "./config/index.js";
import { closeDB, connectDB } from "./db/index.js";
import { ensureIndexes as ensureBrandIndexes } from "./models/brand.model.js";
import { ensureIndexes as ensureCategoryIndexes } from "./models/category.model.js";
import { ensureIndexes as ensureCustomerIndexes } from "./models/customer.model.js";
import { ensureIndexes as ensureInvoiceIndexes } from "./models/invoice.model.js";
import { ensureIndexes as ensurePaymentIndexes } from "./models/payment.model.js";
import { ensureIndexes as ensureProductIndexes } from "./models/product.model.js";
import { ensureIndexes as ensureStockIndexes } from "./models/stock.model.js";
import { ensureIndexes as ensureStockBatchIndexes } from "./models/stock-batch.model.js";
import { ensureIndexes as ensureUnitIndexes } from "./models/unit.model.js";
import { ensureIndexes as ensureUserIndexes } from "./models/user.model.js";

async function start() {
	try {
		await connectDB();
		await Promise.all([
			ensureBrandIndexes(),
			ensureCategoryIndexes(),
			ensureCustomerIndexes(),
			ensureInvoiceIndexes(),
			ensurePaymentIndexes(),
			ensureProductIndexes(),
			ensureStockIndexes(),
			ensureStockBatchIndexes(),
			ensureUnitIndexes(),
			ensureUserIndexes(),
		]);
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
