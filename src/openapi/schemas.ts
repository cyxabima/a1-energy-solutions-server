import { z } from "zod";
import type {
	ZodOpenApiOperationObject,
	ZodOpenApiRequestBodyObject,
	ZodOpenApiResponseObject,
} from "zod-openapi";

/* ---------------------------------- primitives ---------------------------------- */

export const objectId = z
	.string()
	.regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format")
	.meta({
		id: "ObjectId",
		description: "MongoDB ObjectId (24 hex characters)",
		example: "5f9b3b3b3b3b3b3b3b3b3b3b",
	});

export const paramId = z
	.string()
	.regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format")
	.meta({ description: "Resource ID (ObjectId)" });

export const dateTime = z.string().meta({
	id: "DateTime",
	description: "ISO 8601 date-time",
	example: "2026-08-05T10:00:00.000Z",
	format: "date-time",
});

export const money = z.number().meta({
	id: "Money",
	description: "Money amount rounded to 2 decimals",
	example: 1234.5,
});

export const pagination = z
	.object({
		page: z.number().int().positive(),
		limit: z.number().int().positive(),
		total: z.number().int().nonnegative(),
		totalPages: z.number().int().nonnegative(),
	})
	.meta({ id: "Pagination", description: "Pagination metadata" });

export const errorEnvelope = z
	.object({
		success: z.literal(false),
		statusCode: z.number(),
		errorType: z.string(),
		message: z.string(),
		stack: z.string().optional(),
	})
	.meta({ description: "Error response envelope" });

/* ---------------------------------- lite refs ---------------------------------- */

export const userLite = z
	.object({ _id: objectId, name: z.string() })
	.meta({ id: "UserLite", description: "Minimal user reference" });

export const customerLite = z
	.object({ _id: objectId, name: z.string() })
	.meta({ id: "CustomerLite", description: "Minimal customer reference" });

export const invoiceLite = z
	.object({ _id: objectId, invoiceNumber: z.string() })
	.meta({ id: "InvoiceLite", description: "Minimal invoice reference" });

export const productLite = z
	.object({
		_id: objectId,
		name: z.string(),
		barcode: z.string(),
	})
	.meta({ id: "ProductLite", description: "Minimal product reference" });

/* ---------------------------------- auth / users ---------------------------------- */

const userRole = z.enum(["ADMIN", "OWNER", "STAFF"]);

export const safeUser = z
	.object({
		_id: objectId,
		name: z.string(),
		email: z.string(),
		role: userRole,
		avatarUrl: z.string().optional(),
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "User", description: "User document without password" });

export const authUser = z
	.object({
		_id: objectId,
		name: z.string(),
		email: z.string(),
		role: userRole,
		avatarUrl: z.string().optional(),
	})
	.meta({ id: "AuthUser", description: "Authenticated user (from JWT)" });

export const authResponse = z
	.object({
		user: safeUser,
		token: z
			.string()
			.meta({ description: "JWT (also set as httpOnly cookie `accessToken`)" }),
	})
	.meta({ id: "AuthResponse", description: "Login/register response" });

/* ---------------------------------- categories ---------------------------------- */

export const categoryAttribute = z
	.object({
		name: z.string(),
		type: z.enum(["select", "text", "number"]),
		required: z.boolean(),
		possibleValues: z.array(z.string()),
	})
	.meta({
		id: "CategoryAttribute",
		description: "Category attribute definition",
	});

const categoryFields = {
	_id: objectId,
	name: z.string(),
	slug: z.string(),
	path: z.string(),
	depth: z.number().int().nonnegative(),
	parentId: objectId.nullable(),
	attributes: z.array(categoryAttribute),
	createdBy: objectId,
	createdAt: dateTime,
	updatedAt: dateTime,
};

export const category = z
	.object(categoryFields)
	.meta({ id: "Category", description: "Category document" });

export const categoryTreeNode: z.ZodTypeAny = z
	.lazy(() =>
		z.object({
			...categoryFields,
			children: z.array(categoryTreeNode),
		}),
	)
	.meta({
		id: "CategoryTreeNode",
		description: "Category with nested children",
	});

export const categoryAttributesView = z
	.object({
		categoryId: z.string(),
		categoryName: z.string(),
		ancestors: z.array(z.string()),
		attributes: z.array(categoryAttribute),
	})
	.meta({
		id: "CategoryAttributesView",
		description: "Inherited category attributes",
	});

/* ---------------------------------- brands / units ---------------------------------- */

export const brand = z
	.object({
		_id: objectId,
		name: z.string(),
		description: z.string(),
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "Brand", description: "Brand document" });

export const unit = z
	.object({
		_id: objectId,
		name: z.string(),
		symbol: z.string(),
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "Unit", description: "Unit of measure document" });

/* ---------------------------------- products ---------------------------------- */

export const productAttribute = z
	.object({
		name: z.string(),
		value: z.string(),
	})
	.meta({ id: "ProductAttribute", description: "Product attribute value" });

export const product = z
	.object({
		_id: objectId,
		name: z.string(),
		barcode: z.string(),
		category: objectId,
		brand: objectId,
		unit: objectId,
		owner: objectId,
		attributes: z.array(productAttribute),
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "Product", description: "Product document" });

/* ---------------------------------- stocks ---------------------------------- */

const movementType = z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]);

export const batchConsumption = z
	.object({
		batchId: objectId,
		quantity: z.number(),
		buyingPrice: money,
	})
	.meta({
		id: "BatchConsumption",
		description: "FIFO batch consumption record",
	});

export const stockBatch = z
	.object({
		_id: objectId,
		product: objectId,
		buyingPrice: money,
		initialQty: z.number(),
		remainingQty: z.number(),
		createdBy: objectId,
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "StockBatch", description: "FIFO stock batch" });

export const stockMovement = z
	.object({
		_id: objectId,
		product: objectId,
		quantity: z.number(),
		type: movementType,
		buyingPrice: money.optional(),
		salePrice: money.optional(),
		reason: z.string(),
		reference: z.string().optional(),
		toOwner: objectId.optional(),
		createdBatchId: objectId.optional(),
		batchConsumptions: z.array(batchConsumption).optional(),
		createdBy: objectId,
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "StockMovement", description: "Stock movement document" });

export const stockMovementView = z
	.object({
		_id: objectId,
		product: productLite,
		quantity: z.number(),
		type: movementType,
		buyingPrice: money.optional(),
		salePrice: money.optional(),
		reason: z.string(),
		reference: z.string().optional(),
		toOwner: userLite.nullable(),
		createdBatchId: objectId.optional(),
		batchConsumptions: z.array(batchConsumption).optional(),
		createdBy: userLite,
		createdAt: dateTime,
	})
	.meta({
		id: "StockMovementView",
		description: "Stock movement with resolved product/user references",
	});

export const stockSummaryRow = z
	.object({
		_id: objectId,
		name: z.string(),
		barcode: z.string(),
		category: objectId,
		brand: objectId,
		unit: objectId,
		owner: objectId,
		currentStock: z.number(),
		totalValue: money,
		latestBatchPrice: money,
	})
	.meta({ id: "StockSummaryRow", description: "Product stock summary row" });

/* ---------------------------------- customers ---------------------------------- */

export const customer = z
	.object({
		_id: objectId,
		name: z.string(),
		phone: z.string().optional(),
		email: z.string().optional(),
		address: z.string().optional(),
		notes: z.string().optional(),
		createdBy: objectId,
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "Customer", description: "Customer document" });

export const customerStats = z
	.object({
		totalInvoices: z.number().int().nonnegative(),
		totalPurchased: money,
		outstandingBalance: money,
	})
	.meta({ id: "CustomerStats", description: "Customer sales statistics" });

export const customerDetail = z
	.object({
		customer,
		stats: customerStats,
	})
	.meta({ id: "CustomerDetail", description: "Customer with stats" });

/* ---------------------------------- invoices ---------------------------------- */

const invoiceStatus = z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]);

export const invoiceItem = z
	.object({
		product: objectId,
		quantity: z.number().int().positive(),
		unitPrice: money,
		discount: money,
		total: money,
		stockMovementId: objectId.optional(),
		batchConsumptions: z.array(batchConsumption).optional(),
		costOfGoodsSold: money.optional(),
	})
	.meta({ id: "InvoiceItem", description: "Invoice line item" });

export const invoice = z
	.object({
		_id: objectId,
		invoiceNumber: z.string(),
		customer: objectId.optional(),
		items: z.array(invoiceItem),
		subtotal: money,
		discount: money,
		taxRate: z.number(),
		tax: money,
		total: money,
		paidAmount: money,
		balance: money,
		status: invoiceStatus,
		reference: z.string().optional(),
		createdBy: objectId,
		createdAt: dateTime,
		updatedAt: dateTime,
		confirmedAt: dateTime.optional(),
		cancelledAt: dateTime.optional(),
		cancelledBy: objectId.optional(),
	})
	.meta({ id: "Invoice", description: "Invoice document" });

export const invoiceSummary = z
	.object({
		_id: objectId,
		invoiceNumber: z.string(),
		customer: customerLite.nullable(),
		itemsCount: z.number().int().nonnegative(),
		subtotal: money,
		discount: money,
		tax: money,
		total: money,
		paidAmount: money,
		balance: money,
		status: invoiceStatus,
		reference: z.string().optional(),
		createdBy: userLite,
		createdAt: dateTime,
		confirmedAt: dateTime.optional(),
	})
	.meta({ id: "InvoiceSummary", description: "Invoice list item" });

export const invoiceDetail = z
	.object({
		invoice,
		customer: customerLite.nullable(),
		createdBy: userLite,
		items: z.array(
			z.object({
				product: z.object({
					_id: objectId,
					name: z.string(),
					barcode: z.string(),
					unit: z.string(),
				}),
				quantity: z.number().int().positive(),
				unitPrice: money,
				discount: money,
				total: money,
				stockMovementId: objectId.optional(),
				batchConsumptions: z.array(batchConsumption).optional(),
				costOfGoodsSold: money.optional(),
				grossProfit: money.optional(),
			}),
		),
		payments: z.array(
			z.object({
				_id: objectId,
				amount: money,
				method: z.string(),
				reference: z.string().optional(),
				createdBy: userLite,
				createdAt: dateTime,
			}),
		),
		summary: z.object({
			cogs: money,
			profit: money,
		}),
	})
	.meta({
		id: "InvoiceDetail",
		description:
			"Full invoice with resolved items, payments and profit summary",
	});

/* ---------------------------------- payments ---------------------------------- */

const paymentMethod = z.enum(["CASH", "CARD", "TRANSFER", "CHEQUE"]);

export const payment = z
	.object({
		_id: objectId,
		invoice: objectId,
		amount: money,
		method: paymentMethod,
		reference: z.string().optional(),
		createdBy: objectId,
		createdAt: dateTime,
		updatedAt: dateTime,
	})
	.meta({ id: "Payment", description: "Payment document" });

export const paymentSummary = z
	.object({
		_id: objectId,
		invoice: invoiceLite,
		amount: money,
		method: paymentMethod,
		reference: z.string().optional(),
		createdBy: userLite,
		createdAt: dateTime,
	})
	.meta({ id: "PaymentSummary", description: "Payment list item" });

/* ---------------------------------- reports ---------------------------------- */

export const salesReportBucket = z
	.object({
		key: z.string(),
		totalInvoices: z.number().int().nonnegative(),
		revenue: money,
		tax: money,
		total: money,
		cogs: money,
		profit: money,
	})
	.meta({ id: "SalesReportBucket", description: "Sales report period bucket" });

export const salesReport = z
	.object({
		period: z.enum(["day", "month"]),
		from: dateTime,
		to: dateTime,
		summary: salesReportBucket.omit({ key: true }),
		breakdown: z.array(salesReportBucket),
	})
	.meta({ id: "SalesReport", description: "Sales report over a date range" });

export const productReportRow = z
	.object({
		product: productLite,
		quantity: z.number(),
		revenue: money,
		cogs: money,
		profit: money,
	})
	.meta({ id: "ProductReportRow", description: "Top product report row" });

export const customerReportRow = z
	.object({
		customer: customerLite.nullable(),
		invoiceCount: z.number().int().nonnegative(),
		revenue: money,
		total: money,
		balance: money,
	})
	.meta({ id: "CustomerReportRow", description: "Top customer report row" });

/* ---------------------------------- dashboard ---------------------------------- */

export const dashboardTrendPoint = z
	.object({
		date: z.string(),
		in: z.number(),
		out: z.number(),
		adjustment: z.number(),
	})
	.meta({
		id: "DashboardTrendPoint",
		description: "Stock movement trend point",
	});

export const dashboardProductMetric = z
	.object({
		_id: objectId,
		name: z.string(),
		barcode: z.string(),
		currentStock: z.number(),
		totalValue: money,
	})
	.meta({ id: "DashboardProductMetric", description: "Product stock metric" });

export const dashboardBreakdownItem = z
	.object({
		_id: objectId,
		name: z.string(),
		units: z.number(),
		value: money,
	})
	.meta({
		id: "DashboardBreakdownItem",
		description: "Stock breakdown by category or brand",
	});

export const recentMovement = z
	.object({
		_id: objectId,
		product: productLite,
		quantity: z.number(),
		type: z.string(),
		reason: z.string(),
		createdBy: userLite,
		createdAt: dateTime,
	})
	.meta({ id: "RecentMovement", description: "Recent stock movement" });

export const dashboardSalesTrendPoint = z
	.object({
		date: z.string(),
		revenue: money,
	})
	.meta({
		id: "DashboardSalesTrendPoint",
		description: "Sales revenue trend point",
	});

export const dashboardSales = z
	.object({
		revenueToday: money,
		revenueMonth: money,
		invoicesMonth: z.number().int().nonnegative(),
		unpaidBalance: money,
		topProducts: z.array(productReportRow),
		salesTrend7d: z.array(dashboardSalesTrendPoint),
		salesTrend6m: z.array(dashboardSalesTrendPoint),
	})
	.meta({ id: "DashboardSales", description: "Sales KPIs" });

export const dashboardStats = z
	.object({
		overview: z.object({
			productCount: z.number().int().nonnegative(),
			totalUnitsInStock: z.number(),
			stockValue: money,
			lowStockCount: z.number().int().nonnegative(),
		}),
		movementTrends: z.array(dashboardTrendPoint),
		monthlyTrends: z.array(dashboardTrendPoint),
		recentMovements: z.array(recentMovement),
		topProducts: z.array(dashboardProductMetric),
		lowStockProducts: z.array(dashboardProductMetric),
		categoryBreakdown: z.array(dashboardBreakdownItem),
		brandBreakdown: z.array(dashboardBreakdownItem),
		sales: dashboardSales,
	})
	.meta({ id: "DashboardStats", description: "Dashboard statistics" });

/* ---------------------------------- settings ---------------------------------- */

export const businessSettings = z
	.object({
		_id: z.string(),
		businessName: z.string(),
		address: z.string(),
		phone: z.string(),
		email: z.string().optional(),
		vatNumber: z.string().optional(),
		footerNote: z.string().optional(),
		logoUrl: z.string().optional(),
		updatedBy: objectId,
		updatedAt: dateTime,
	})
	.meta({
		id: "BusinessSettings",
		description: "Business settings (singleton document)",
	});

/* ---------------------------------- response helpers ---------------------------------- */

export function ok(
	data: z.ZodType,
	description: string,
): ZodOpenApiResponseObject {
	return {
		description,
		content: {
			"application/json": {
				schema: z.object({
					success: z.literal(true),
					statusCode: z.number(),
					message: z.string(),
					data,
				}),
			},
		},
	};
}

export function err(
	statusCode: number,
	errorType: string,
	description: string,
): ZodOpenApiResponseObject {
	return {
		description: `${statusCode} — ${description} (${errorType})`,
		content: {
			"application/json": {
				schema: { $ref: "#/components/schemas/ErrorEnvelope" },
			},
		},
	};
}

export const nothing = z.null();

export const secured: NonNullable<ZodOpenApiOperationObject["security"]> = [
	{ bearerAuth: [] },
];

export const badRequest = err(
	400,
	"BAD_REQUEST",
	"Invalid request: validation or business rule failure",
);
export const unauthorized = err(401, "UNAUTHORIZED", "Missing or invalid JWT");
export const forbidden = err(
	403,
	"FORBIDDEN",
	"Your role cannot perform this action",
);
export const notFound = err(404, "NOT_FOUND", "Resource not found");
export const conflict = err(
	409,
	"CONFLICT",
	"Resource already exists or conflicts",
);

export function jsonBody(
	schema: z.ZodType,
	description = "Request body",
): ZodOpenApiRequestBodyObject {
	return {
		description,
		required: true,
		content: {
			"application/json": { schema },
		},
	};
}
