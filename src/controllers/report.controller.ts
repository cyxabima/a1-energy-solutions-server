import type { Request, Response } from "express";
import {
	type CustomerReportRow,
	getSalesReport,
	getTopCustomers,
	getTopProducts,
	type ProductReportRow,
	type ProductReportSort,
	type ReportPeriod,
	type SalesReport,
} from "../models/report.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

const DEFAULT_RANGE_DAYS = 30;

function parseDate(value: string | undefined, label: string): Date | undefined {
	if (value === undefined || value === "") return undefined;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new ApiError(400, "BAD_REQUEST", `Invalid '${label}' date format`);
	}
	return date;
}

function dateRange(req: Request): { from: Date; to: Date } {
	const from = parseDate(
		typeof req.query.from === "string" ? req.query.from : undefined,
		"from",
	);
	const to = parseDate(
		typeof req.query.to === "string" ? req.query.to : undefined,
		"to",
	);

	const end = to ?? new Date();
	const start =
		from ?? new Date(Date.now() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

	if (start > end) {
		throw new ApiError(400, "BAD_REQUEST", "'from' must be before 'to'");
	}
	return { from: start, to: end };
}

function parseLimit(value: unknown, fallback: number): number {
	if (typeof value !== "string" || value === "") return fallback;
	const parsed = Number(value);
	if (Number.isNaN(parsed)) {
		throw new ApiError(400, "BAD_REQUEST", "Invalid 'limit'");
	}
	return Math.min(100, Math.max(1, parsed));
}

export async function getSalesReportHandler(req: Request, res: Response) {
	const { from, to } = dateRange(req);

	const periodValue =
		typeof req.query.period === "string" ? req.query.period : "day";
	if (periodValue !== "day" && periodValue !== "month") {
		throw new ApiError(400, "BAD_REQUEST", "period must be 'day' or 'month'");
	}

	const params: {
		period: ReportPeriod;
		from: Date;
		to: Date;
		customer?: string;
		createdBy?: string;
	} = { period: periodValue, from, to };
	if (typeof req.query.customer === "string" && req.query.customer.trim()) {
		params.customer = req.query.customer.trim();
	}
	if (typeof req.query.createdBy === "string" && req.query.createdBy.trim()) {
		params.createdBy = req.query.createdBy.trim();
	}

	const report = await getSalesReport(params);

	return res
		.status(200)
		.json(
			new ApiResponse<SalesReport>(
				200,
				report,
				"Sales report fetched successfully",
			),
		);
}

export async function getTopProductsHandler(req: Request, res: Response) {
	const { from, to } = dateRange(req);

	const sortValue =
		typeof req.query.sort === "string" ? req.query.sort : "revenue";
	if (!["revenue", "quantity", "profit"].includes(sortValue)) {
		throw new ApiError(
			400,
			"BAD_REQUEST",
			"sort must be 'revenue', 'quantity' or 'profit'",
		);
	}
	const limit = parseLimit(req.query.limit, 10);

	const products = await getTopProducts({
		from,
		to,
		sort: sortValue as ProductReportSort,
		limit,
	});

	return res
		.status(200)
		.json(
			new ApiResponse<ProductReportRow[]>(
				200,
				products,
				"Products report fetched successfully",
			),
		);
}

export async function getTopCustomersHandler(req: Request, res: Response) {
	const { from, to } = dateRange(req);
	const limit = parseLimit(req.query.limit, 10);

	const customers = await getTopCustomers({ from, to, limit });

	return res
		.status(200)
		.json(
			new ApiResponse<CustomerReportRow[]>(
				200,
				customers,
				"Customers report fetched successfully",
			),
		);
}
