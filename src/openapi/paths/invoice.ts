import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createInvoiceSchema,
	updateInvoiceSchema,
} from "../../validations/invoice.validation.js";
import { addPaymentSchema } from "../../validations/payment.validation.js";
import {
	badRequest,
	forbidden,
	invoice,
	invoiceDetail,
	invoiceSummary,
	jsonBody,
	notFound,
	nothing,
	ok,
	pagination,
	paramId,
	payment,
	secured,
	unauthorized,
} from "../schemas.js";

const idPathParams = {
	path: z.object({
		id: paramId.meta({ description: "Invoice ID (ObjectId)" }),
	}),
};

const invoiceIdPathParams = {
	path: z.object({
		invoiceId: paramId.meta({ description: "Invoice ID (ObjectId)" }),
	}),
};

const listQuery = z.object({
	search: z.string().optional(),
	status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
	customer: paramId.optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/invoices": {
		get: {
			operationId: "listInvoices",
			tags: ["Invoices"],
			summary: "Get invoices",
			description: "Paginated invoice summaries.",
			security: secured,
			requestParams: { query: listQuery },
			responses: {
				"200": ok(
					z.object({
						invoices: z.array(invoiceSummary),
						pagination,
					}),
					"Invoices fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createInvoice",
			tags: ["Invoices"],
			summary: "Create a draft invoice",
			description:
				"ADMIN, OWNER or STAFF. Recomputes totals server-side; starts in DRAFT status.",
			security: secured,
			requestBody: jsonBody(createInvoiceSchema, "Invoice fields"),
			responses: {
				"201": ok(invoice, "Invoice created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
	"/invoices/{id}": {
		get: {
			operationId: "getInvoice",
			tags: ["Invoices"],
			summary: "Get a full invoice",
			description:
				"Returns items with resolved products, payments, and the profit summary.",
			security: secured,
			requestParams: idPathParams,
			responses: {
				"200": ok(invoiceDetail, "Invoice fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
		patch: {
			operationId: "updateInvoice",
			tags: ["Invoices"],
			summary: "Update a draft invoice",
			description: "ADMIN, OWNER or STAFF. Only DRAFT invoices can be updated.",
			security: secured,
			requestParams: idPathParams,
			requestBody: jsonBody(updateInvoiceSchema, "Invoice fields"),
			responses: {
				"200": ok(invoice, "Invoice updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
		delete: {
			operationId: "deleteInvoice",
			tags: ["Invoices"],
			summary: "Delete a draft invoice",
			description: "ADMIN only. Only DRAFT invoices can be deleted.",
			security: secured,
			requestParams: idPathParams,
			responses: {
				"200": ok(nothing, "Invoice deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
	"/invoices/{id}/confirm": {
		post: {
			operationId: "confirmInvoice",
			tags: ["Invoices"],
			summary: "Confirm an invoice",
			description:
				"ADMIN, OWNER or STAFF. Consumes stock via FIFO batches, stamps COGS and creates OUT movements. Transactional.",
			security: secured,
			requestParams: idPathParams,
			responses: {
				"200": ok(invoiceDetail, "Invoice confirmed successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
	"/invoices/{id}/cancel": {
		post: {
			operationId: "cancelInvoice",
			tags: ["Invoices"],
			summary: "Cancel an invoice",
			description:
				"ADMIN, OWNER or STAFF. Confirmed invoices with payments cannot be cancelled; stock is restored via `restoreBatch`.",
			security: secured,
			requestParams: idPathParams,
			responses: {
				"200": ok(invoice, "Invoice cancelled successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
	"/invoices/{invoiceId}/payments": {
		post: {
			operationId: "addInvoicePayment",
			tags: ["Invoices"],
			summary: "Add a payment to an invoice",
			description:
				"ADMIN, OWNER or STAFF. Only CONFIRMED invoices. Uses a conditional update to stay race-safe against double payments.",
			security: secured,
			requestParams: invoiceIdPathParams,
			requestBody: jsonBody(addPaymentSchema, "Payment fields"),
			responses: {
				"201": ok(payment, "Payment added successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
};
