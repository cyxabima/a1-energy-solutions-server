import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import { createStockSchema } from "../../validations/stock.validation.js";
import {
	badRequest,
	jsonBody,
	notFound,
	nothing,
	ok,
	pagination,
	paramId,
	productLite,
	secured,
	stockBatch,
	stockMovement,
	stockMovementView,
	stockSummaryRow,
	unauthorized,
} from "../schemas.js";

const idPathParams = {
	path: z.object({
		id: paramId.meta({ description: "Stock movement ID (ObjectId)" }),
	}),
};

const productPathParams = {
	path: z.object({
		productId: paramId.meta({ description: "Product ID (ObjectId)" }),
	}),
};

const movementsQuery = z.object({
	search: z.string().optional(),
	product: paramId.optional(),
	type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]).optional(),
	owner: paramId.optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

const summaryQuery = z.object({
	search: z.string().optional(),
	category: paramId.optional(),
	brand: paramId.optional(),
	owner: paramId.optional(),
	lowStock: z.string().optional().meta({
		description:
			"`true` or a numeric threshold; filters rows with currentStock <= threshold",
	}),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

const historyQuery = z.object({
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/stocks": {
		get: {
			operationId: "listStockMovements",
			tags: ["Stocks"],
			summary: "Get stock movements",
			description:
				"Paginated movement audit log with resolved product/user references.",
			security: secured,
			requestParams: { query: movementsQuery },
			responses: {
				"200": ok(
					z.object({
						movements: z.array(stockMovementView),
						pagination,
					}),
					"Stock movements fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createStockMovement",
			tags: ["Stocks"],
			summary: "Record a stock movement",
			description:
				"ADMIN, OWNER or STAFF. IN creates a FIFO batch, OUT/ADJUSTMENT consume batches FIFO, TRANSFER moves stock to another owner.",
			security: secured,
			requestBody: jsonBody(createStockSchema, "Movement fields"),
			responses: {
				"201": ok(stockMovement, "Stock movement recorded successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
	},
	"/stocks/summary": {
		get: {
			operationId: "getStockSummary",
			tags: ["Stocks"],
			summary: "Get stock summary",
			description:
				"Paginated per-product current stock, value and latest batch buying price.",
			security: secured,
			requestParams: { query: summaryQuery },
			responses: {
				"200": ok(
					z.object({
						summary: z.array(stockSummaryRow),
						pagination,
					}),
					"Stock summary fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
	},
	"/stocks/product/{productId}": {
		get: {
			operationId: "getProductStockHistory",
			tags: ["Stocks"],
			summary: "Get a product's stock history",
			description:
				"Current stock, total value, active batches and paginated movements.",
			security: secured,
			requestParams: { ...productPathParams, query: historyQuery },
			responses: {
				"200": ok(
					z.object({
						product: productLite,
						currentStock: z.number(),
						totalValue: z.number(),
						batches: z.array(stockBatch),
						movements: z.array(stockMovementView),
						pagination,
					}),
					"Product stock history fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
	},
	"/stocks/{id}": {
		delete: {
			operationId: "deleteStockMovement",
			tags: ["Stocks"],
			summary: "Delete a stock movement",
			description:
				"ADMIN only. Restores batches consumed by OUT/ADJUSTMENT and refuses to delete IN/ADJUSTMENT batches that were already consumed.",
			security: secured,
			requestParams: idPathParams,
			responses: {
				"200": ok(nothing, "Stock movement deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
	},
};
