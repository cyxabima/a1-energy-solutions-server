import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createCategorySchema,
	updateCategorySchema,
} from "../../validations/category.validation.js";
import {
	badRequest,
	category,
	categoryAttributesView,
	categoryTreeNode,
	forbidden,
	jsonBody,
	notFound,
	ok,
	paramId,
	secured,
	unauthorized,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "Category ID (ObjectId)" }),
	}),
};

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/categories/tree": {
		get: {
			operationId: "listCategoryTree",
			tags: ["Categories"],
			summary: "Get category tree",
			description:
				"Returns all categories nested into a tree. ADMIN can also create/update/delete.",
			security: secured,
			responses: {
				"200": ok(
					z.array(categoryTreeNode),
					"Category tree fetched successfully",
				),
				"401": unauthorized,
			},
		},
	},
	"/categories": {
		get: {
			operationId: "listCategories",
			tags: ["Categories"],
			summary: "Get all categories (flat)",
			security: secured,
			responses: {
				"200": ok(z.array(category), "Categories fetched successfully"),
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createCategory",
			tags: ["Categories"],
			summary: "Create a category",
			description: "ADMIN only. Root when `parentId` is omitted.",
			security: secured,
			requestBody: jsonBody(createCategorySchema, "Category fields"),
			responses: {
				"201": ok(category, "Category created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
			},
		},
	},
	"/categories/{id}": {
		get: {
			operationId: "getCategory",
			tags: ["Categories"],
			summary: "Get a category",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(category, "Category fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
		put: {
			operationId: "updateCategory",
			tags: ["Categories"],
			summary: "Update a category",
			description: "ADMIN only. Renaming updates descendant paths.",
			security: secured,
			requestParams: pathParams,
			requestBody: jsonBody(updateCategorySchema, "Category fields"),
			responses: {
				"200": ok(category, "Category updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
		delete: {
			operationId: "deleteCategory",
			tags: ["Categories"],
			summary: "Delete a category",
			description: "ADMIN only. Deletes the category and all descendants.",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(
					z.object({ deletedCount: z.number().int() }),
					"Category deleted successfully",
				),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
	"/categories/{id}/attributes": {
		get: {
			operationId: "getCategoryAttributes",
			tags: ["Categories"],
			summary: "Get inherited attributes for a category",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(
					categoryAttributesView,
					"Category attributes fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
	},
	"/categories/{id}/ancestors": {
		get: {
			operationId: "getCategoryAncestors",
			tags: ["Categories"],
			summary: "Get a category's ancestors",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(z.array(category), "Ancestors fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
	},
};
