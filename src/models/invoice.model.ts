import {
	type ClientSession,
	type Collection,
	ObjectId,
	type OptionalId,
} from "mongodb";
import { getDb } from "../db/index.js";
import { findProductsByIds, type Product } from "./product.model.js";
import type { BatchConsumption } from "./stock-batch.model.js";

// NOTE: PAID status is dynamic if remaining amount is zero than paid
export type InvoiceStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface InvoiceItem {
	product: ObjectId;
	quantity: number;
	unitPrice: number;
	discount: number;
	total: number;
	stockMovementId?: ObjectId;
	batchConsumptions?: BatchConsumption[];
	costOfGoodsSold?: number;
}

export interface Invoice {
	_id: ObjectId;
	invoiceNumber: string;
	customer?: ObjectId;
	items: InvoiceItem[];
	subtotal: number;
	discount: number;
	taxRate: number;
	tax: number;
	total: number;
	paidAmount: number;
	balance: number;
	status: InvoiceStatus;
	reference?: string;
	createdBy: ObjectId;
	createdAt: Date;
	updatedAt: Date;
	confirmedAt?: Date;
	cancelledAt?: Date;
	cancelledBy?: ObjectId;
}

export type CreateInvoiceInput = Omit<
	Invoice,
	"_id" | "invoiceNumber" | "createdAt" | "updatedAt"
>;

export interface InvoiceSummary {
	_id: ObjectId;
	invoiceNumber: string;
	customer: { _id: ObjectId; name: string } | null;
	itemsCount: number;
	subtotal: number;
	discount: number;
	tax: number;
	total: number;
	paidAmount: number;
	balance: number;
	status: InvoiceStatus;
	reference?: string;
	createdBy: { _id: ObjectId; name: string };
	createdAt: Date;
	confirmedAt?: Date;
}

export interface InvoiceDetail {
	invoice: Invoice;
	customer: { _id: ObjectId; name: string } | null;
	createdBy: { _id: ObjectId; name: string };
	items: InvoiceDetailItem[];
	payments: InvoicePayment[];
	summary: InvoiceDetailSummary;
}

export interface InvoiceDetailItem {
	product: { _id: ObjectId; name: string; barcode: string; unit: string };
	quantity: number;
	unitPrice: number;
	discount: number;
	total: number;
	stockMovementId?: ObjectId;
	batchConsumptions?: BatchConsumption[];
	costOfGoodsSold?: number;
	grossProfit?: number;
}

export interface InvoiceDetailSummary {
	cogs: number;
	profit: number;
}

export interface InvoicePayment {
	_id: ObjectId;
	amount: number;
	method: string;
	reference?: string;
	createdBy: { _id: ObjectId; name: string };
	createdAt: Date;
}

export function round2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

function collection(): Collection<OptionalId<Invoice>> {
	return getDb().collection<OptionalId<Invoice>>("invoices");
}

function countersCollection(): Collection<{ _id: string; seq: number }> {
	return getDb().collection<{ _id: string; seq: number }>("counters");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ invoiceNumber: 1 }, { unique: true });
	await col.createIndex({ customer: 1 });
	await col.createIndex({ status: 1 });
	await col.createIndex({ createdBy: 1 });
	await col.createIndex({ createdAt: -1 });
	await col.createIndex({ status: 1, confirmedAt: -1 });
}

async function generateInvoiceNumber(): Promise<string> {
	const counter = await countersCollection().findOneAndUpdate(
		{ _id: "invoice_number" },
		{ $inc: { seq: 1 } },
		{ upsert: true, returnDocument: "after" },
	);

	const seq = counter?.seq ?? 1;
	return `INV-${String(seq).padStart(6, "0")}`;
}

export async function createInvoice(
	data: CreateInvoiceInput,
): Promise<Invoice> {
	const now = new Date();
	const invoiceNumber = await generateInvoiceNumber();

	const doc: OptionalId<Invoice> = {
		...data,
		invoiceNumber,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Invoice;
}

export async function findInvoiceById(
	id: string,
	session?: ClientSession,
): Promise<Invoice | null> {
	return collection().findOne(
		{ _id: new ObjectId(id) },
		session ? { session } : undefined,
	) as Promise<Invoice | null>;
}

export async function getInvoices(params: {
	search?: string;
	status?: string;
	customer?: string;
	page?: number;
	limit?: number;
}): Promise<{ invoices: InvoiceSummary[]; total: number }> {
	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const matchStage: Record<string, unknown> = {};
	if (params.search) {
		matchStage.invoiceNumber = { $regex: params.search, $options: "i" };
	}
	if (params.status) matchStage.status = params.status;
	if (params.customer) matchStage.customer = new ObjectId(params.customer);

	const pipeline: Record<string, unknown>[] = [];
	if (Object.keys(matchStage).length > 0) {
		pipeline.push({ $match: matchStage });
	}

	pipeline.push(
		{
			$lookup: {
				from: "customers",
				localField: "customer",
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
		{
			$project: {
				_id: 1,
				invoiceNumber: 1,
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
				itemsCount: { $size: "$items" },
				subtotal: 1,
				discount: 1,
				tax: 1,
				total: 1,
				paidAmount: 1,
				balance: 1,
				status: 1,
				reference: 1,
				createdBy: {
					_id: "$createdByDoc._id",
					name: "$createdByDoc.name",
				},
				createdAt: 1,
				confirmedAt: 1,
			},
		},
		{ $sort: { createdAt: -1 } },
	);

	const countPipeline = [{ $match: matchStage }, { $count: "total" }];
	const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

	const [countResult, invoices] = await Promise.all([
		collection().aggregate(countPipeline).toArray(),
		collection().aggregate(dataPipeline).toArray(),
	]);

	const total = (countResult[0] as { total?: number } | undefined)?.total ?? 0;

	return {
		invoices: invoices as unknown as InvoiceSummary[],
		total,
	};
}

export async function getInvoiceDetail(
	id: string,
): Promise<InvoiceDetail | null> {
	const invoice = await collection().findOne({ _id: new ObjectId(id) });
	if (!invoice) return null;

	const productIds = invoice.items.map((item) => item.product);
	const [products, customerDoc, createdByDoc, payments] = await Promise.all([
		productIds.length > 0 ? findProductsByIds(productIds) : Promise.resolve([]),
		invoice.customer
			? getDb().collection("customers").findOne({ _id: invoice.customer })
			: Promise.resolve(null),
		getDb().collection("users").findOne({ _id: invoice.createdBy }),
		getDb()
			.collection("payments")
			.find({ invoice: invoice._id })
			.sort({ createdAt: -1 })
			.toArray(),
	]);

	const paymentCreatorIds = [
		...new Set(payments.map((payment) => payment.createdBy.toString())),
	].map((value) => new ObjectId(value));
	const paymentCreators =
		paymentCreatorIds.length > 0
			? getDb()
					.collection("users")
					.find({ _id: { $in: paymentCreatorIds } })
					.toArray()
			: Promise.resolve([]);
	const paymentCreatorMap = new Map<string, string>();
	for (const user of await paymentCreators) {
		paymentCreatorMap.set(user._id.toString(), user.name);
	}

	const productMap = new Map<string, Product>();
	for (const product of products) {
		productMap.set(product._id.toString(), product);
	}

	const items: InvoiceDetailItem[] = invoice.items.map((item) => {
		const product = productMap.get(item.product.toString());
		const result: InvoiceDetailItem = {
			product: {
				_id: item.product,
				name: product?.name ?? "Unknown product",
				barcode: product?.barcode ?? "",
				unit: product?.unit.toString() ?? "",
			},
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			discount: item.discount,
			total: item.total,
		};
		if (item.stockMovementId !== undefined) {
			result.stockMovementId = item.stockMovementId;
		}
		if (item.batchConsumptions !== undefined) {
			result.batchConsumptions = item.batchConsumptions;
		}
		if (item.costOfGoodsSold !== undefined) {
			result.costOfGoodsSold = item.costOfGoodsSold;
			result.grossProfit = round2(item.total - item.costOfGoodsSold);
		}
		return result;
	});

	let cogs = 0;
	for (const item of invoice.items) {
		cogs += item.costOfGoodsSold ?? 0;
	}
	cogs = round2(cogs);
	const summary: InvoiceDetailSummary = {
		cogs,
		profit: round2(invoice.subtotal - invoice.discount - cogs),
	};

	return {
		invoice,
		customer: customerDoc
			? { _id: customerDoc._id, name: customerDoc.name }
			: null,
		createdBy: {
			_id: createdByDoc?._id ?? invoice.createdBy,
			name: createdByDoc?.name ?? "Unknown",
		},
		items,
		payments: payments.map((payment) => ({
			_id: payment._id,
			amount: payment.amount,
			method: payment.method,
			reference: payment.reference,
			createdBy: {
				_id: payment.createdBy,
				name: paymentCreatorMap.get(payment.createdBy.toString()) ?? "Unknown",
			},
			createdAt: payment.createdAt,
		})),
		summary,
	};
}

export async function updateInvoice(
	id: string,
	data: {
		customer?: ObjectId;
		items?: InvoiceItem[];
		subtotal?: number;
		discount?: number;
		taxRate?: number;
		tax?: number;
		total?: number;
		balance?: number;
		reference?: string;
	},
): Promise<Invoice | null> {
	const update: Record<string, unknown> = { updatedAt: new Date() };
	if (data.customer !== undefined) update.customer = data.customer;
	if (data.items !== undefined) update.items = data.items;
	if (data.subtotal !== undefined) update.subtotal = data.subtotal;
	if (data.discount !== undefined) update.discount = data.discount;
	if (data.taxRate !== undefined) update.taxRate = data.taxRate;
	if (data.tax !== undefined) update.tax = data.tax;
	if (data.total !== undefined) update.total = data.total;
	if (data.balance !== undefined) update.balance = data.balance;
	if (data.reference !== undefined) update.reference = data.reference;

	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	) as Promise<Invoice | null>;
}

export async function markConfirmed(
	id: string,
	items: InvoiceItem[],
	total: number,
	session?: ClientSession,
): Promise<Invoice | null> {
	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{
			$set: {
				items,
				status: "CONFIRMED",
				confirmedAt: new Date(),
				balance: total,
				updatedAt: new Date(),
			},
		},
		session
			? { returnDocument: "after", session }
			: { returnDocument: "after" },
	) as Promise<Invoice | null>;
}

export async function markCancelled(
	id: string,
	cancelledBy: ObjectId,
): Promise<Invoice | null> {
	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{
			$set: {
				status: "CANCELLED",
				cancelledAt: new Date(),
				cancelledBy,
				updatedAt: new Date(),
			},
		},
		{ returnDocument: "after" },
	) as Promise<Invoice | null>;
}

export async function adjustPaid(
	id: string,
	delta: number,
): Promise<Invoice | null> {
	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{
			$inc: { paidAmount: round2(delta), balance: round2(-delta) },
			$set: { updatedAt: new Date() },
		},
		{ returnDocument: "after" },
	) as Promise<Invoice | null>;
}

export async function adjustPaidIfPossible(
	id: string,
	amount: number,
): Promise<Invoice | null> {
	return collection().findOneAndUpdate(
		{
			_id: new ObjectId(id),
			status: "CONFIRMED",
			balance: { $gte: round2(amount) },
		},
		{
			$inc: { paidAmount: round2(amount), balance: round2(-amount) },
			$set: { updatedAt: new Date() },
		},
		{ returnDocument: "after" },
	) as Promise<Invoice | null>;
}

export async function deleteInvoice(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}
