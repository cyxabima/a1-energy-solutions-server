import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createProductSchema,
	updateProductSchema,
} from "../../validations/product.validation.js";
import {
	badRequest,
	forbidden,
	jsonBody,
	notFound,
	nothing,
	ok,
	pagination,
	paramId,
	product,
	secured,
	unauthorized,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "Product ID (ObjectId)" }),
	}),
};

const listQuery = z.object({
	search: z.string().optional(),
	barcode: z.string().optional(),
	category: paramId.optional(),
	brand: paramId.optional(),
	unit: paramId.optional(),
	owner: paramId.optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/products": {
		get: {
			operationId: "listProducts",
			tags: ["Products"],
			summary: "Get products",
			description: "Paginated. STAFF can read but not create/update/delete.",
			security: secured,
			requestParams: { query: listQuery },
			responses: {
				"200": ok(
					z.object({
						products: z.array(product),
						pagination,
					}),
					"Products fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createProduct",
			tags: ["Products"],
			summary: "Create a product",
			description:
				"ADMIN or OWNER. Name and barcode are auto-generated from the category + attributes.",
			security: secured,
			requestBody: jsonBody(createProductSchema, "Product fields"),
			responses: {
				"201": ok(product, "Product created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
	"/products/{id}": {
		get: {
			operationId: "getProduct",
			tags: ["Products"],
			summary: "Get a product",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(product, "Product fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
		put: {
			operationId: "updateProduct",
			tags: ["Products"],
			summary: "Update a product",
			description: "ADMIN or OWNER.",
			security: secured,
			requestParams: pathParams,
			requestBody: jsonBody(updateProductSchema, "Product fields"),
			responses: {
				"200": ok(product, "Product updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
		delete: {
			operationId: "deleteProduct",
			tags: ["Products"],
			summary: "Delete a product",
			description: "ADMIN only. Fails while the product still has stock.",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(nothing, "Product deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
};
