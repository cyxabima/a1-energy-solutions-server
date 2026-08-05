import type { Request, Response } from "express";
import {
	type DashboardStats,
	getDashboardStats,
} from "../models/dashboard.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

const VALID_SECTIONS = [
	"overview",
	"trends",
	"recent",
	"top",
	"low",
	"breakdowns",
	"sales",
];

export async function getDashboardStatsHandler(req: Request, res: Response) {
	const ownerParam = typeof req.query.owner === "string" ? req.query.owner : "";
	const owner = ownerParam || undefined;

	const includeParam =
		typeof req.query.include === "string" ? req.query.include : "";
	const include = new Set<string>();
	for (const section of includeParam
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)) {
		if (!VALID_SECTIONS.includes(section)) {
			throw new ApiError(
				400,
				"BAD_REQUEST",
				`Invalid dashboard section: ${section}. Allowed: ${VALID_SECTIONS.join(", ")}`,
			);
		}
		include.add(section);
	}

	const params: { owner?: string; include?: Set<string> } = {};
	if (owner) params.owner = owner;
	if (include.size > 0) params.include = include;

	const stats = await getDashboardStats(params);

	return res
		.status(200)
		.json(
			new ApiResponse<DashboardStats>(
				200,
				stats,
				"Dashboard stats fetched successfully",
			),
		);
}
