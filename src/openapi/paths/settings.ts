import type { ZodOpenApiPathItemObject } from "zod-openapi";
import { updateBusinessSettingsSchema } from "../../validations/settings.validation.js";
import {
	businessSettings,
	forbidden,
	jsonBody,
	ok,
	secured,
	unauthorized,
} from "../schemas.js";

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/settings/business": {
		get: {
			operationId: "getBusinessSettings",
			tags: ["Settings"],
			summary: "Get business settings",
			description:
				"Returns a defaults template (empty strings) when unset. Used by the frontend for invoice letterheads.",
			security: secured,
			responses: {
				"200": ok(businessSettings, "Business settings fetched successfully"),
				"401": unauthorized,
			},
		},
		put: {
			operationId: "updateBusinessSettings",
			tags: ["Settings"],
			summary: "Update business settings",
			description:
				"ADMIN only. `businessName` is required; omitted optional fields stay unchanged, `null` clears a field.",
			security: secured,
			requestBody: jsonBody(
				updateBusinessSettingsSchema,
				"Business settings fields",
			),
			responses: {
				"200": ok(businessSettings, "Business settings updated successfully"),
				"401": unauthorized,
				"403": forbidden,
			},
		},
	},
};
