import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createBrandSchema,
	updateBrandSchema,
} from "../../validations/brand.validation.js";
import {
	badRequest,
	brand,
	conflict,
	forbidden,
	jsonBody,
	notFound,
	nothing,
	ok,
	paramId,
	secured,
	unauthorized,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "Brand ID (ObjectId)" }),
	}),
};

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/brands": {
		get: {
			operationId: "listBrands",
			tags: ["Brands"],
			summary: "Get all brands",
			security: secured,
			responses: {
				"200": ok(z.array(brand), "Brands fetched successfully"),
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createBrand",
			tags: ["Brands"],
			summary: "Create a brand",
			description: "ADMIN only.",
			security: secured,
			requestBody: jsonBody(createBrandSchema, "Brand fields"),
			responses: {
				"201": ok(brand, "Brand created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"409": conflict,
			},
		},
	},
	"/brands/{id}": {
		get: {
			operationId: "getBrand",
			tags: ["Brands"],
			summary: "Get a brand",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(brand, "Brand fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
		put: {
			operationId: "updateBrand",
			tags: ["Brands"],
			summary: "Update a brand",
			description: "ADMIN only.",
			security: secured,
			requestParams: pathParams,
			requestBody: jsonBody(updateBrandSchema, "Brand fields"),
			responses: {
				"200": ok(brand, "Brand updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
				"409": conflict,
			},
		},
		delete: {
			operationId: "deleteBrand",
			tags: ["Brands"],
			summary: "Delete a brand",
			description: "ADMIN only.",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(nothing, "Brand deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
};
