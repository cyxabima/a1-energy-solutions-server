import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	createUserSchema,
	updateUserSchema,
} from "../../validations/user.validation.js";
import {
	badRequest,
	conflict,
	forbidden,
	jsonBody,
	notFound,
	ok,
	pagination,
	paramId,
	safeUser,
	secured,
	unauthorized,
} from "../schemas.js";

const pathParams = {
	path: z.object({
		id: paramId.meta({ description: "User ID (ObjectId)" }),
	}),
};

const listQuery = z.object({
	search: z.string().optional(),
	role: z.enum(["ADMIN", "OWNER", "STAFF"]).optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/users": {
		get: {
			operationId: "listUsers",
			tags: ["Users"],
			summary: "Get users",
			description: "ADMIN only. Paginated, passwords excluded.",
			security: secured,
			requestParams: { query: listQuery },
			responses: {
				"200": ok(
					z.object({
						users: z.array(safeUser),
						pagination,
					}),
					"Users fetched successfully",
				),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
			},
		},
		post: {
			operationId: "createUser",
			tags: ["Users"],
			summary: "Create a user",
			description:
				"ADMIN only. Users get the requested role (roles are only assigned here).",
			security: secured,
			requestBody: jsonBody(createUserSchema, "User fields"),
			responses: {
				"201": ok(safeUser, "User created successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"409": conflict,
			},
		},
	},
	"/users/{id}": {
		patch: {
			operationId: "updateUser",
			tags: ["Users"],
			summary: "Update a user",
			description: "ADMIN only.",
			security: secured,
			requestParams: pathParams,
			requestBody: jsonBody(updateUserSchema, "User fields"),
			responses: {
				"200": ok(safeUser, "User updated successfully"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
				"409": conflict,
			},
		},
	},
};
