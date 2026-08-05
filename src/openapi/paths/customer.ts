import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createCustomerSchema,
	updateCustomerSchema,
} from "../../validations/customer.validation.js";
import {
	badRequest,
	conflict,
	customer,
	customerDetail,
	forbidden,
	jsonBody,
	notFound,
	nothing,
	ok,
	pagination,
	paramId,
	secured,
	unauthorized,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "Customer ID (ObjectId)" }),
	}),
};

const listQuery = z.object({
	search: z.string().optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/customers": {
		get: {
			operationId: "listCustomers",
			tags: ["Customers"],
			summary: "Get customers",
			description: "Paginated.",
			security: secured,
			requestParams: { query: listQuery },
			responses: {
				"200": ok(
					z.object({
						customers: z.array(customer),
						pagination,
					}),
					"Customers fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createCustomer",
			tags: ["Customers"],
			summary: "Create a customer",
			description: "ADMIN, OWNER or STAFF.",
			security: secured,
			requestBody: jsonBody(createCustomerSchema, "Customer fields"),
			responses: {
				"201": ok(customer, "Customer created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
			},
		},
	},
	"/customers/{id}": {
		get: {
			operationId: "getCustomer",
			tags: ["Customers"],
			summary: "Get a customer with stats",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(customerDetail, "Customer fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
		patch: {
			operationId: "updateCustomer",
			tags: ["Customers"],
			summary: "Update a customer",
			description: "ADMIN, OWNER or STAFF.",
			security: secured,
			requestParams: pathParams,
			requestBody: jsonBody(updateCustomerSchema, "Customer fields"),
			responses: {
				"200": ok(customer, "Customer updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
		delete: {
			operationId: "deleteCustomer",
			tags: ["Customers"],
			summary: "Delete a customer",
			description:
				"ADMIN only. Fails if the customer has confirmed invoices; unassigns draft/cancelled invoices.",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(nothing, "Customer deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
				"409": conflict,
			},
		},
	},
};
