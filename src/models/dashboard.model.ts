import { ObjectId } from "mongodb";
import { getDb } from "../db/index.js";
import { round2 } from "./invoice.model.js";
import { getTopProducts, type ProductReportRow } from "./report.model.js";

const LOW_STOCK_THRESHOLD = 5;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_MOVEMENTS_LIMIT = 5;
const TREND_DAYS = 7;
const TREND_MONTHS = 6;

export interface DashboardTrendPoint {
	date: string;
	in: number;
	out: number;
	adjustment: number;
}

export interface DashboardProductMetric {
	_id: ObjectId;
	name: string;
	barcode: string;
	currentStock: number;
	totalValue: number;
}

export interface DashboardBreakdownItem {
	_id: ObjectId;
	name: string;
	units: number;
	value: number;
}

export interface RecentMovement {
	_id: ObjectId;
	product: { _id: ObjectId; name: string; barcode: string };
	quantity: number;
	type: string;
	reason: string;
	createdBy: { _id: ObjectId; name: string };
	createdAt: Date;
}

export interface DashboardOverview {
	productCount: number;
	totalUnitsInStock: number;
	stockValue: number;
	lowStockCount: number;
}

export interface DashboardSalesTrendPoint {
	date: string;
	revenue: number;
}

export interface DashboardSales {
	revenueToday: number;
	revenueMonth: number;
	invoicesMonth: number;
	unpaidBalance: number;
	topProducts: ProductReportRow[];
	salesTrend7d: DashboardSalesTrendPoint[];
	salesTrend6m: DashboardSalesTrendPoint[];
}

export interface DashboardStats {
	overview: DashboardOverview;
	movementTrends: DashboardTrendPoint[];
	monthlyTrends: DashboardTrendPoint[];
	recentMovements: RecentMovement[];
	topProducts: DashboardProductMetric[];
	lowStockProducts: DashboardProductMetric[];
	categoryBreakdown: DashboardBreakdownItem[];
	brandBreakdown: DashboardBreakdownItem[];
	sales: DashboardSales;
}

interface BatchRow {
	_id: ObjectId;
	units: number;
	value: number;
	productDoc: {
		_id: ObjectId;
		name: string;
		barcode: string;
		owner: ObjectId;
		category: ObjectId;
		brand: ObjectId;
	};
}

interface DailyMovementRow {
	_id: string;
	in: number;
	out: number;
	adjustment: number;
}

interface BreakdownAccumulator {
	_id: ObjectId;
	units: number;
	value: number;
}

function utcDateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function utcMonthKey(date: Date): string {
	return date.toISOString().slice(0, 7);
}

async function resolveBreakdownNames(
	collectionName: "categories" | "brands",
	accumulators: Map<string, BreakdownAccumulator>,
): Promise<DashboardBreakdownItem[]> {
	if (accumulators.size === 0) return [];

	const ids = [...accumulators.values()].map((entry) => entry._id);
	const docs = await getDb()
		.collection<{ _id: ObjectId; name: string }>(collectionName)
		.find({ _id: { $in: ids } })
		.toArray();
	const nameMap = new Map(docs.map((doc) => [doc._id.toString(), doc.name]));

	return [...accumulators.values()]
		.map((entry) => ({
			_id: entry._id,
			name: nameMap.get(entry._id.toString()) ?? "Unknown",
			units: entry.units,
			value: entry.value,
		}))
		.sort((a, b) => b.value - a.value);
}

export async function getDashboardStats(params: {
	owner?: string;
	include?: Set<string>;
}): Promise<DashboardStats> {
	const { owner, include } = params;
	const includeAll = !include || include.size === 0;
	const wants = (section: string): boolean =>
		includeAll || include?.has(section) === true;

	const db = getDb();
	const productsCol = db.collection<{ owner: ObjectId }>("products");
	const batchesCol = db.collection("stock_batches");
	const movementsCol = db.collection("stock_movements");

	const ownerMatch = owner ? { "productDoc.owner": new ObjectId(owner) } : null;
	const productOwnerQuery = owner ? { owner: new ObjectId(owner) } : {};

	const stats: DashboardStats = {
		overview: {
			productCount: 0,
			totalUnitsInStock: 0,
			stockValue: 0,
			lowStockCount: 0,
		},
		movementTrends: [],
		monthlyTrends: [],
		recentMovements: [],
		topProducts: [],
		lowStockProducts: [],
		categoryBreakdown: [],
		brandBreakdown: [],
		sales: {
			revenueToday: 0,
			revenueMonth: 0,
			invoicesMonth: 0,
			unpaidBalance: 0,
			topProducts: [],
			salesTrend7d: [],
			salesTrend6m: [],
		},
	};

	const jobs: Promise<void>[] = [];

	if (
		wants("overview") ||
		wants("top") ||
		wants("low") ||
		wants("breakdowns")
	) {
		jobs.push(
			(async () => {
				const pipeline: Record<string, unknown>[] = [
					{ $match: { remainingQty: { $gt: 0 } } },
					{
						$group: {
							_id: "$product",
							units: { $sum: "$remainingQty" },
							value: {
								$sum: {
									$multiply: ["$remainingQty", "$buyingPrice"],
								},
							},
						},
					},
					{
						$lookup: {
							from: "products",
							localField: "_id",
							foreignField: "_id",
							as: "productDoc",
						},
					},
					{ $unwind: "$productDoc" },
				];
				if (ownerMatch) pipeline.push({ $match: ownerMatch });

				const rows = (await batchesCol
					.aggregate(pipeline)
					.toArray()) as unknown as BatchRow[];

				if (wants("overview")) {
					stats.overview.productCount =
						await productsCol.countDocuments(productOwnerQuery);
					let units = 0;
					let value = 0;
					let lowStockCount = 0;
					for (const row of rows) {
						units += row.units;
						value += row.value;
						if (row.units <= LOW_STOCK_THRESHOLD) lowStockCount += 1;
					}
					stats.overview.totalUnitsInStock = units;
					stats.overview.stockValue = value;
					stats.overview.lowStockCount = lowStockCount;
				}

				if (wants("top")) {
					stats.topProducts = [...rows]
						.sort((a, b) => b.value - a.value)
						.slice(0, TOP_PRODUCTS_LIMIT)
						.map((row) => ({
							_id: row._id,
							name: row.productDoc.name,
							barcode: row.productDoc.barcode,
							currentStock: row.units,
							totalValue: row.value,
						}));
				}

				if (wants("low")) {
					stats.lowStockProducts = rows
						.filter((row) => row.units <= LOW_STOCK_THRESHOLD)
						.sort((a, b) => a.units - b.units)
						.slice(0, TOP_PRODUCTS_LIMIT)
						.map((row) => ({
							_id: row._id,
							name: row.productDoc.name,
							barcode: row.productDoc.barcode,
							currentStock: row.units,
							totalValue: row.value,
						}));
				}

				if (wants("breakdowns")) {
					const categories = new Map<string, BreakdownAccumulator>();
					const brands = new Map<string, BreakdownAccumulator>();

					for (const row of rows) {
						const catId = row.productDoc.category;
						const brandId = row.productDoc.brand;
						const catKey = catId.toString();
						const brandKey = brandId.toString();

						const cat = categories.get(catKey) ?? {
							_id: catId,
							units: 0,
							value: 0,
						};
						cat.units += row.units;
						cat.value += row.value;
						categories.set(catKey, cat);

						const brand = brands.get(brandKey) ?? {
							_id: brandId,
							units: 0,
							value: 0,
						};
						brand.units += row.units;
						brand.value += row.value;
						brands.set(brandKey, brand);
					}

					stats.categoryBreakdown = await resolveBreakdownNames(
						"categories",
						categories,
					);
					stats.brandBreakdown = await resolveBreakdownNames("brands", brands);
				}
			})(),
		);
	}

	if (wants("trends") || wants("recent")) {
		jobs.push(
			(async () => {
				const since = new Date();
				since.setUTCMonth(since.getUTCMonth() - (TREND_MONTHS - 1));
				since.setUTCDate(1);
				since.setUTCHours(0, 0, 0, 0);

				const pipeline: Record<string, unknown>[] = [
					{ $match: { createdAt: { $gte: since } } },
					{
						$lookup: {
							from: "products",
							localField: "product",
							foreignField: "_id",
							as: "productDoc",
						},
					},
					{ $unwind: "$productDoc" },
				];
				if (ownerMatch) pipeline.push({ $match: ownerMatch });
				pipeline.push(
					{
						$group: {
							_id: {
								$dateToString: {
									format: "%Y-%m-%d",
									date: "$createdAt",
								},
							},
							in: {
								$sum: {
									$cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0],
								},
							},
							out: {
								$sum: {
									$cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0],
								},
							},
							adjustment: {
								$sum: {
									$cond: [{ $eq: ["$type", "ADJUSTMENT"] }, "$quantity", 0],
								},
							},
						},
					},
					{ $sort: { _id: 1 } },
				);

				const dailyRows = (await movementsCol
					.aggregate(pipeline)
					.toArray()) as unknown as DailyMovementRow[];

				if (wants("trends")) {
					const dailyMap = new Map(dailyRows.map((row) => [row._id, row]));

					const today = new Date();
					for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
						const day = new Date(
							Date.UTC(
								today.getUTCFullYear(),
								today.getUTCMonth(),
								today.getUTCDate() - i,
							),
						);
						const key = utcDateKey(day);
						const row = dailyMap.get(key);
						stats.movementTrends.push({
							date: key,
							in: row?.in ?? 0,
							out: row?.out ?? 0,
							adjustment: row?.adjustment ?? 0,
						});
					}

					for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
						const month = new Date(
							Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
						);
						const key = utcMonthKey(month);
						let inSum = 0;
						let outSum = 0;
						let adjustmentSum = 0;
						for (const [date, row] of dailyMap) {
							if (date.startsWith(key)) {
								inSum += row.in;
								outSum += row.out;
								adjustmentSum += row.adjustment;
							}
						}
						stats.monthlyTrends.push({
							date: key,
							in: inSum,
							out: outSum,
							adjustment: adjustmentSum,
						});
					}
				}

				if (wants("recent")) {
					const recentPipeline: Record<string, unknown>[] = [
						{
							$lookup: {
								from: "products",
								localField: "product",
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
							$lookup: {
								from: "users",
								localField: "createdBy",
								foreignField: "_id",
								as: "createdByDoc",
							},
						},
						{
							$unwind: {
								path: "$createdByDoc",
								preserveNullAndEmptyArrays: true,
							},
						},
					];
					if (ownerMatch) recentPipeline.push({ $match: ownerMatch });
					recentPipeline.push(
						{ $sort: { createdAt: -1 } },
						{ $limit: RECENT_MOVEMENTS_LIMIT },
						{
							$project: {
								_id: 1,
								product: {
									_id: "$productDoc._id",
									name: "$productDoc.name",
									barcode: "$productDoc.barcode",
								},
								quantity: 1,
								type: 1,
								reason: 1,
								createdBy: {
									_id: "$createdByDoc._id",
									name: "$createdByDoc.name",
								},
								createdAt: 1,
							},
						},
					);

					stats.recentMovements = (await movementsCol
						.aggregate(recentPipeline)
						.toArray()) as unknown as RecentMovement[];
				}
			})(),
		);
	}

	if (wants("sales")) {
		jobs.push(
			(async () => {
				const today = new Date();
				const todayKey = utcDateKey(today);
				const monthKey = utcMonthKey(today);
				const sixMonthsAgo = new Date(
					Date.UTC(
						today.getUTCFullYear(),
						today.getUTCMonth() - (TREND_MONTHS - 1),
						1,
					),
				);
				const monthStart = new Date(
					Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
				);

				const invoicesCol = getDb().collection("invoices");

				const dailyRows = (await invoicesCol
					.aggregate([
						{
							$match: {
								status: "CONFIRMED",
								confirmedAt: { $gte: sixMonthsAgo },
							},
						},
						{
							$group: {
								_id: {
									$dateToString: {
										format: "%Y-%m-%d",
										date: "$confirmedAt",
									},
								},
								revenue: {
									$sum: { $subtract: ["$subtotal", "$discount"] },
								},
								totalInvoices: { $sum: 1 },
							},
						},
					])
					.toArray()) as unknown as {
					_id: string;
					revenue?: number;
					totalInvoices?: number;
				}[];

				const dailyMap = new Map(
					dailyRows.map((row) => [
						row._id,
						{
							revenue: row.revenue ?? 0,
							totalInvoices: row.totalInvoices ?? 0,
						},
					]),
				);

				stats.sales.revenueToday = round2(dailyMap.get(todayKey)?.revenue ?? 0);

				let revenueMonth = 0;
				let invoicesMonth = 0;
				for (const [date, row] of dailyMap) {
					if (date.startsWith(monthKey)) {
						revenueMonth += row.revenue;
						invoicesMonth += row.totalInvoices;
					}
				}
				stats.sales.revenueMonth = round2(revenueMonth);
				stats.sales.invoicesMonth = invoicesMonth;

				const unpaidRows = (await invoicesCol
					.aggregate([
						{ $match: { status: "CONFIRMED" } },
						{
							$group: {
								_id: null,
								unpaid: { $sum: "$balance" },
							},
						},
					])
					.toArray()) as unknown as { unpaid?: number }[];
				stats.sales.unpaidBalance = round2(unpaidRows[0]?.unpaid ?? 0);

				const trend7d: DashboardSalesTrendPoint[] = [];
				for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
					const day = new Date(
						Date.UTC(
							today.getUTCFullYear(),
							today.getUTCMonth(),
							today.getUTCDate() - i,
						),
					);
					const key = utcDateKey(day);
					trend7d.push({
						date: key,
						revenue: round2(dailyMap.get(key)?.revenue ?? 0),
					});
				}
				stats.sales.salesTrend7d = trend7d;

				const trend6m: DashboardSalesTrendPoint[] = [];
				for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
					const month = new Date(
						Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
					);
					const key = utcMonthKey(month);
					let revenue = 0;
					for (const [date, row] of dailyMap) {
						if (date.startsWith(key)) revenue += row.revenue;
					}
					trend6m.push({ date: key, revenue: round2(revenue) });
				}
				stats.sales.salesTrend6m = trend6m;

				stats.sales.topProducts = await getTopProducts({
					from: monthStart,
					to: today,
					sort: "revenue",
					limit: TOP_PRODUCTS_LIMIT,
				});
			})(),
		);
	}

	await Promise.all(jobs);
	return stats;
}
