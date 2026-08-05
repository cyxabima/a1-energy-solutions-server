import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createUnitSchema,
	updateUnitSchema,
} from "../../validations/unit.validation.js";
import {
	badRequest,
	conflict,
	forbidden,
	jsonBody,
	notFound,
	nothing,
	ok,
	paramId,
	secured,
	unauthorized,
	unit,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "Unit ID (ObjectId)" }),
	}),
};

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/units": {
		get: {
			operationId: "listUnits",
			tags: ["Units"],
			summary: "Get all units",
			security: secured,
			responses: {
				"200": ok(z.array(unit), "Units fetched successfully"),
				"401": unauthorized,
			},
		},
		post: {
			operationId: "createUnit",
			tags: ["Units"],
			summary: "Create a unit",
			description: "ADMIN only.",
			security: secured,
			requestBody: jsonBody(createUnitSchema, "Unit fields"),
			responses: {
				"201": ok(unit, "Unit created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"409": conflict,
			},
		},
	},
	"/units/{id}": {
		get: {
			operationId: "getUnit",
			tags: ["Units"],
			summary: "Get a unit",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(unit, "Unit fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
		put: {
			operationId: "updateUnit",
			tags: ["Units"],
			summary: "Update a unit",
			description: "ADMIN only.",
			security: secured,
			requestParams: pathParams,
			requestBody: jsonBody(updateUnitSchema, "Unit fields"),
			responses: {
				"200": ok(unit, "Unit updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
				"409": conflict,
			},
		},
		delete: {
			operationId: "deleteUnit",
			tags: ["Units"],
			summary: "Delete a unit",
			description: "ADMIN only.",
			security: secured,
			requestParams: pathParams,
			responses: {
				"200": ok(nothing, "Unit deleted successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
};
