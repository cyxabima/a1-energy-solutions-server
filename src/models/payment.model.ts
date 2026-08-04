import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CHEQUE";

export interface Payment {
	_id: ObjectId;
	invoice: ObjectId;
	amount: number;
	method: PaymentMethod;
	reference?: string;
	createdBy: ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export type CreatePaymentInput = Omit<
	Payment,
	"_id" | "createdAt" | "updatedAt"
>;

export interface PaymentSummary {
	_id: ObjectId;
	invoice: { _id: ObjectId; invoiceNumber: string };
	amount: number;
	method: PaymentMethod;
	reference?: string;
	createdBy: { _id: ObjectId; name: string };
	createdAt: Date;
}

function collection(): Collection<OptionalId<Payment>> {
	return getDb().collection<OptionalId<Payment>>("payments");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ invoice: 1, createdAt: -1 });
	await col.createIndex({ method: 1 });
	await col.createIndex({ createdBy: 1 });
}

export async function createPayment(
	data: CreatePaymentInput,
): Promise<Payment> {
	const now = new Date();
	const doc: OptionalId<Payment> = {
		...data,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Payment;
}

export async function findPaymentById(id: string): Promise<Payment | null> {
	return collection().findOne({ _id: new ObjectId(id) });
}

export async function getPayments(params: {
	invoice?: string;
	method?: string;
	page?: number;
	limit?: number;
}): Promise<{ payments: PaymentSummary[]; total: number }> {
	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const matchStage: Record<string, unknown> = {};
	if (params.invoice) matchStage.invoice = new ObjectId(params.invoice);
	if (params.method) matchStage.method = params.method;

	const pipeline: Record<string, unknown>[] = [
		{
			$lookup: {
				from: "invoices",
				localField: "invoice",
				foreignField: "_id",
				as: "invoiceDoc",
			},
		},
		{
			$unwind: {
				path: "$invoiceDoc",
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
	if (Object.keys(matchStage).length > 0) {
		pipeline.push({ $match: matchStage });
	}
	pipeline.push(
		{
			$project: {
				_id: 1,
				invoice: {
					_id: "$invoiceDoc._id",
					invoiceNumber: "$invoiceDoc.invoiceNumber",
				},
				amount: 1,
				method: 1,
				reference: 1,
				createdBy: {
					_id: "$createdByDoc._id",
					name: "$createdByDoc.name",
				},
				createdAt: 1,
			},
		},
		{ $sort: { createdAt: -1 } },
	);

	const countPipeline = [{ $match: matchStage }, { $count: "total" }];
	const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

	const [countResult, payments] = await Promise.all([
		collection().aggregate(countPipeline).toArray(),
		collection().aggregate(dataPipeline).toArray(),
	]);

	const total = (countResult[0] as { total?: number } | undefined)?.total ?? 0;

	return {
		payments: payments as unknown as PaymentSummary[],
		total,
	};
}

export async function deletePayment(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}
