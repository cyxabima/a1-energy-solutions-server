import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export interface Customer {
	_id: ObjectId;
	name: string;
	phone?: string;
	email?: string;
	address?: string;
	notes?: string;
	createdBy: ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateCustomerInput = Omit<
	Customer,
	"_id" | "createdAt" | "updatedAt"
>;
export type UpdateCustomerInput = Partial<
	Pick<Customer, "name" | "phone" | "email" | "address" | "notes">
>;

export interface CustomerStats {
	totalInvoices: number;
	totalPurchased: number;
	outstandingBalance: number;
}

// NOTE: Just like a escape sequence charcheter we are escaping some charcheters that are part of regex so that new Regx in the other function doesnot break
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collection(): Collection<OptionalId<Customer>> {
	return getDb().collection<OptionalId<Customer>>("customers");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ name: 1 });
}

export async function createCustomer(
	data: CreateCustomerInput,
): Promise<Customer> {
	const now = new Date();
	const doc: OptionalId<Customer> = {
		...data,
		name: data.name.trim(),
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Customer;
}

export async function findCustomerById(id: string): Promise<Customer | null> {
	return collection().findOne({ _id: new ObjectId(id) });
}

export async function getCustomers(params: {
	search?: string;
	page?: number;
	limit?: number;
}): Promise<{ customers: Customer[]; total: number }> {
	const query: Record<string, unknown> = {};

	if (params.search) {
		const regex = new RegExp(escapeRegex(params.search), "i");
		query.$or = [{ name: regex }, { phone: regex }, { email: regex }];
	}

	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const [customers, total] = await Promise.all([
		collection()
			.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray(),
		collection().countDocuments(query),
	]);

	return { customers: customers as Customer[], total };
}

export async function updateCustomer(
	id: string,
	data: UpdateCustomerInput,
): Promise<Customer | null> {
	const update: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) update.name = data.name.trim();
	if (data.phone !== undefined) update.phone = data.phone;
	if (data.email !== undefined) update.email = data.email;
	if (data.address !== undefined) update.address = data.address;
	if (data.notes !== undefined) update.notes = data.notes;

	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	) as Promise<Customer | null>;
}

export async function deleteCustomer(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}

export async function countInvoicesByCustomer(
	customerId: string,
): Promise<number> {
	return getDb()
		.collection("invoices")
		.countDocuments({ customer: new ObjectId(customerId) });
}

export async function getCustomerStats(
	customerId: string,
): Promise<CustomerStats> {
	const pipeline = [
		{ $match: { customer: new ObjectId(customerId), status: "CONFIRMED" } },
		{
			$group: {
				_id: null,
				totalInvoices: { $sum: 1 },
				totalPurchased: { $sum: "$total" },
				outstandingBalance: { $sum: "$balance" },
			},
		},
	];

	const results = await getDb()
		.collection("invoices")
		.aggregate(pipeline)
		.toArray();
	const row = results[0] as
		| {
				totalInvoices?: number;
				totalPurchased?: number;
				outstandingBalance?: number;
		  }
		| undefined;

	return {
		totalInvoices: row?.totalInvoices ?? 0,
		totalPurchased: Math.round((row?.totalPurchased ?? 0) * 100) / 100,
		outstandingBalance: Math.round((row?.outstandingBalance ?? 0) * 100) / 100,
	};
}
