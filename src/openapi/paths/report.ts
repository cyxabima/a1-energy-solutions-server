import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	badRequest,
	customerReportRow,
	ok,
	paramId,
	productReportRow,
	salesReport,
	secured,
	unauthorized,
} from "../schemas.js";

const dateParam = z
	.string()
	.meta({ description: "Date (ISO 8601), e.g. 2026-08-01" });

const salesQuery = z.object({
	period: z.enum(["day", "month"]).optional(),
	from: dateParam.optional(),
	to: dateParam.optional(),
	customer: paramId.optional(),
	createdBy: paramId.optional(),
});

const productsQuery = z.object({
	from: dateParam.optional(),
	to: dateParam.optional(),
	sort: z.enum(["revenue", "quantity", "profit"]).optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

const customersQuery = z.object({
	from: dateParam.optional(),
	to: dateParam.optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/reports/sales": {
		get: {
			operationId: "getSalesReport",
			tags: ["Reports"],
			summary: "Get sales report",
			description:
				"Confirmed invoices grouped by day or month. Defaults to the last 30 days.",
			security: secured,
			requestParams: { query: salesQuery },
			responses: {
				"200": ok(salesReport, "Sales report fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
			},
		},
	},
	"/reports/products": {
		get: {
			operationId: "getTopProducts",
			tags: ["Reports"],
			summary: "Get top products",
			description:
				"Top products by revenue, quantity or profit over a date range.",
			security: secured,
			requestParams: { query: productsQuery },
			responses: {
				"200": ok(
					z.array(productReportRow),
					"Products report fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
	},
	"/reports/customers": {
		get: {
			operationId: "getTopCustomers",
			tags: ["Reports"],
			summary: "Get top customers",
			description: "Top customers by revenue over a date range.",
			security: secured,
			requestParams: { query: customersQuery },
			responses: {
				"200": ok(
					z.array(customerReportRow),
					"Customers report fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
	},
};
