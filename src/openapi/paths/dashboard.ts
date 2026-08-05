import { z } from "zod";
import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	badRequest,
	dashboardStats,
	ok,
	paramId,
	secured,
	unauthorized,
} from "../schemas.js";

const statsQuery = z.object({
	owner: paramId.optional(),
	include: z.string().optional().meta({
		description:
			"Comma-separated sections: overview, trends, recent, top, low, breakdowns, sales. Omit for all.",
	}),
});

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/dashboard/stats": {
		get: {
			operationId: "getDashboardStats",
			tags: ["Dashboard"],
			summary: "Get dashboard stats",
			description:
				"KPIs for the dashboard. `owner` is an optional accounting filter; `include` limits which sections are computed.",
			security: secured,
			requestParams: { query: statsQuery },
			responses: {
				"200": ok(dashboardStats, "Dashboard stats fetched successfully"),
				"400": badRequest,
				"401": unauthorized,
			},
		},
	},
};
