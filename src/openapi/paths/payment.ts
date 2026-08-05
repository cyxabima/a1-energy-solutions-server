import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	badRequest,
	forbidden,
	notFound,
	nothing,
	ok,
	pagination,
	paramId,
	paymentSummary,
	secured,
	unauthorized,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "Payment ID (ObjectId)" }),
	}),
};

const listQuery = z.object({
	invoice: paramId.optional(),
	method: z.enum(["CASH", "CARD", "TRANSFER", "CHEQUE"]).optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/payments": {
		get: {
			operationId: "listPayments",
			tags: ["Payments"],
			summary: "Get payments",
			description: "Paginated payment summaries.",
			security: secured,
			requestParams: { query: listQuery },
			responses: {
				"200": ok(
					z.object({
						payments: z.array(paymentSummary),
						pagination,
					}),
					"Payments fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
	},
	"/payments/{id}": {
		delete: {
			operationId: "deletePayment",
			tags: ["Payments"],
			summary: "Delete a payment",
			description: "ADMIN only. Re-adds the amount to the invoice balance.",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(nothing, "Payment deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
};
