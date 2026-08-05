import { ObjectId } from "mongodb";
import { getDb } from "../db/index.js";
import { round2 } from "./invoice.model.js";

export type ReportPeriod = "day" | "month";
export type ProductReportSort = "revenue" | "quantity" | "profit";

export interface SalesReportBucket {
	key: string;
	totalInvoices: number;
	revenue: number;
	tax: number;
	total: number;
	cogs: number;
	profit: number;
}

export interface SalesReport {
	period: ReportPeriod;
	from: Date;
	to: Date;
	summary: Omit<SalesReportBucket, "key">;
	breakdown: SalesReportBucket[];
}

export interface ProductReportRow {
	product: { _id: ObjectId; name: string; barcode: string };
	quantity: number;
	revenue: number;
	cogs: number;
	profit: number;
}

export interface CustomerReportRow {
	customer: { _id: ObjectId; name: string } | null;
	invoiceCount: number;
	revenue: number;
	total: number;
	balance: number;
}

interface InvoiceBucketRow {
	_id: string;
	totalInvoices?: number;
	revenue?: number;
	tax?: number;
	total?: number;
}

interface CogsBucketRow {
	_id: string;
	cogs?: number;
}

function baseMatch(
	from: Date,
	to: Date,
	customer?: string,
	createdBy?: string,
): Record<string, unknown> {
	const match: Record<string, unknown> = {
		status: "CONFIRMED",
		confirmedAt: { $gte: from, $lte: to },
	};
	if (customer) match.customer = new ObjectId(customer);
	if (createdBy) match.createdBy = new ObjectId(createdBy);
	return match;
}

export async function getSalesReport(params: {
	period: ReportPeriod;
	from: Date;
	to: Date;
	customer?: string;
	createdBy?: string;
}): Promise<SalesReport> {
	const format = params.period === "day" ? "%Y-%m-%d" : "%Y-%m";
	const match = baseMatch(
		params.from,
		params.to,
		params.customer,
		params.createdBy,
	);

	const invoicesCol = getDb().collection("invoices");

	const invoicePipeline: Record<string, unknown>[] = [
		{ $match: match },
		{
			$group: {
				_id: {
					$dateToString: { format, date: "$confirmedAt" },
				},
				totalInvoices: { $sum: 1 },
				revenue: { $sum: { $subtract: ["$subtotal", "$discount"] } },
				tax: { $sum: "$tax" },
				total: { $sum: "$total" },
			},
		},
		{ $sort: { _id: 1 } },
	];

	const cogsPipeline: Record<string, unknown>[] = [
		{ $match: match },
		{ $unwind: "$items" },
		{
			$group: {
				_id: {
					$dateToString: { format, date: "$confirmedAt" },
				},
				cogs: { $sum: "$items.costOfGoodsSold" },
			},
		},
	];

	const [invoiceRows, cogsRows] = await Promise.all([
		invoicesCol.aggregate(invoicePipeline).toArray(),
		invoicesCol.aggregate(cogsPipeline).toArray(),
	]);

	const cogsMap = new Map(
		(cogsRows as unknown as CogsBucketRow[]).map((row) => [
			row._id,
			row.cogs ?? 0,
		]),
	);

	const breakdown: SalesReportBucket[] = (
		invoiceRows as unknown as InvoiceBucketRow[]
	).map((row) => {
		const revenue = round2(row.revenue ?? 0);
		const cogs = round2(cogsMap.get(row._id) ?? 0);
		return {
			key: row._id,
			totalInvoices: row.totalInvoices ?? 0,
			revenue,
			tax: round2(row.tax ?? 0),
			total: round2(row.total ?? 0),
			cogs,
			profit: round2(revenue - cogs),
		};
	});

	const summary: Omit<SalesReportBucket, "key"> = {
		totalInvoices: 0,
		revenue: 0,
		tax: 0,
		total: 0,
		cogs: 0,
		profit: 0,
	};
	for (const bucket of breakdown) {
		summary.totalInvoices += bucket.totalInvoices;
		summary.revenue += bucket.revenue;
		summary.tax += bucket.tax;
		summary.total += bucket.total;
		summary.cogs += bucket.cogs;
		summary.profit += bucket.profit;
	}
	summary.revenue = round2(summary.revenue);
	summary.tax = round2(summary.tax);
	summary.total = round2(summary.total);
	summary.cogs = round2(summary.cogs);
	summary.profit = round2(summary.profit);

	return {
		period: params.period,
		from: params.from,
		to: params.to,
		summary,
		breakdown,
	};
}

export async function getTopProducts(params: {
	from: Date;
	to: Date;
	sort: ProductReportSort;
	limit: number;
}): Promise<ProductReportRow[]> {
	const match = baseMatch(params.from, params.to);

	const pipeline: Record<string, unknown>[] = [
		{ $match: match },
		{ $unwind: "$items" },
		{
			$group: {
				_id: "$items.product",
				quantity: { $sum: "$items.quantity" },
				revenue: { $sum: "$items.total" },
				cogs: { $sum: "$items.costOfGoodsSold" },
			},
		},
		{
			$addFields: {
				profit: { $subtract: ["$revenue", "$cogs"] },
			},
		},
		{ $sort: { [params.sort]: -1 } },
		{ $limit: params.limit },
		{
			$lookup: {
				from: "products",
				localField: "_id",
				foreignField: "_id",
				as: "productDoc",
			},
		},
		{
			$unwind: {
				path: "$productDoc",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				product: {
					_id: "$productDoc._id",
					name: "$productDoc.name",
					barcode: "$productDoc.barcode",
				},
				quantity: 1,
				revenue: 1,
				cogs: 1,
				profit: 1,
			},
		},
	];

	const rows = (await getDb()
		.collection("invoices")
		.aggregate(pipeline)
		.toArray()) as unknown as {
		_id: ObjectId;
		product: { _id: ObjectId; name: string; barcode: string } | null;
		quantity?: number;
		revenue?: number;
		cogs?: number;
		profit?: number;
	}[];

	return rows.map((row) => ({
		product: row.product ?? {
			_id: row._id,
			name: "Unknown product",
			barcode: "",
		},
		quantity: row.quantity ?? 0,
		revenue: round2(row.revenue ?? 0),
		cogs: round2(row.cogs ?? 0),
		profit: round2(row.profit ?? 0),
	}));
}

export async function getTopCustomers(params: {
	from: Date;
	to: Date;
	limit: number;
}): Promise<CustomerReportRow[]> {
	const match = baseMatch(params.from, params.to);

	const pipeline: Record<string, unknown>[] = [
		{ $match: match },
		{
			$group: {
				_id: "$customer",
				invoiceCount: { $sum: 1 },
				revenue: { $sum: { $subtract: ["$subtotal", "$discount"] } },
				total: { $sum: "$total" },
				balance: { $sum: "$balance" },
			},
		},
		{ $sort: { revenue: -1 } },
		{ $limit: params.limit },
		{
			$lookup: {
				from: "customers",
				localField: "_id",
				foreignField: "_id",
				as: "customerDoc",
			},
		},
		{
			$unwind: {
				path: "$customerDoc",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				customer: {
					$cond: {
						if: { $ne: ["$customerDoc", null] },
						// biome-ignore lint/suspicious/noThenProperty: MongoDB
						then: {
							_id: "$customerDoc._id",
							name: "$customerDoc.name",
						},
						else: null,
					},
				},
				invoiceCount: 1,
				revenue: 1,
				total: 1,
				balance: 1,
			},
		},
	];

	const rows = (await getDb()
		.collection("invoices")
		.aggregate(pipeline)
		.toArray()) as unknown as {
		customer: { _id: ObjectId; name: string } | null;
		invoiceCount?: number;
		revenue?: number;
		total?: number;
		balance?: number;
	}[];

	return rows.map((row) => ({
		customer: row.customer,
		invoiceCount: row.invoiceCount ?? 0,
		revenue: round2(row.revenue ?? 0),
		total: round2(row.total ?? 0),
		balance: round2(row.balance ?? 0),
	}));
}
