import {
	type ClientSession,
	type Collection,
	ObjectId,
	type OptionalId,
} from "mongodb";
import { getDb } from "../db/index.js";
import ApiError from "../utils/api-error.js";

export interface StockBatch {
	_id: ObjectId;
	product: ObjectId;
	buyingPrice: number;
	initialQty: number;
	remainingQty: number;
	createdBy: ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export interface BatchConsumption {
	batchId: ObjectId;
	quantity: number;
	buyingPrice: number;
}

export type CreateStockBatchInput = {
	product: ObjectId;
	buyingPrice: number;
	initialQty: number;
	remainingQty: number;
	createdBy: ObjectId;
};

function collection(): Collection<OptionalId<StockBatch>> {
	return getDb().collection<OptionalId<StockBatch>>("stock_batches");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ product: 1, createdAt: 1 });
	await col.createIndex({ product: 1, remainingQty: 1 });
}

export async function createBatch(
	data: CreateStockBatchInput,
): Promise<StockBatch> {
	const now = new Date();
	const doc: OptionalId<StockBatch> = {
		...data,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as StockBatch;
}

export async function consumeBatchesFIFO(
	productId: string,
	quantity: number,
	session?: ClientSession,
): Promise<BatchConsumption[]> {
	const batches = await collection()
		.find(
			{
				product: new ObjectId(productId),
				remainingQty: { $gt: 0 },
			},
			session ? { session } : undefined,
		)
		.sort({ createdAt: 1 })
		.toArray();

	const totalRemaining = batches.reduce(
		(sum, b) => sum + ((b as StockBatch).remainingQty ?? 0),
		0,
	);

	if (totalRemaining < quantity) {
		throw new ApiError(
			400,
			"INSUFFICIENT_STOCK",
			`Insufficient stock. Available: ${totalRemaining}, requested: ${quantity}`,
		);
	}

	const consumptions: BatchConsumption[] = [];
	let remaining = quantity;

	for (const batch of batches) {
		if (remaining <= 0) break;

		const b = batch as StockBatch;
		const consume = Math.min(b.remainingQty, remaining);

		await collection().updateOne(
			{ _id: b._id },
			{ $inc: { remainingQty: -consume }, $set: { updatedAt: new Date() } },
			session ? { session } : undefined,
		);

		consumptions.push({
			batchId: b._id,
			quantity: consume,
			buyingPrice: b.buyingPrice,
		});

		remaining -= consume;
	}

	return consumptions;
}

export async function getBatchesByProduct(
	productId: string,
): Promise<StockBatch[]> {
	return collection()
		.find({ product: new ObjectId(productId) })
		.sort({ createdAt: 1 })
		.toArray() as Promise<StockBatch[]>;
}

export async function getProductStockValue(productId: string): Promise<number> {
	const pipeline = [
		{ $match: { product: new ObjectId(productId), remainingQty: { $gt: 0 } } },
		{
			$group: {
				_id: null,
				totalValue: {
					$sum: { $multiply: ["$remainingQty", "$buyingPrice"] },
				},
			},
		},
	];

	const results = await collection().aggregate(pipeline).toArray();
	return (results[0] as { totalValue?: number } | undefined)?.totalValue ?? 0;
}

export async function getLatestBatchPrice(productId: string): Promise<number> {
	const results = await collection()
		.find({ product: new ObjectId(productId) })
		.sort({ createdAt: -1 })
		.limit(1)
		.toArray();
	return (results[0] as StockBatch | undefined)?.buyingPrice ?? 0;
}

export async function restoreBatch(
	batchId: ObjectId,
	quantity: number,
): Promise<void> {
	await collection().updateOne(
		{ _id: batchId },
		{ $inc: { remainingQty: quantity }, $set: { updatedAt: new Date() } },
	);
}

export async function deleteBatch(id: ObjectId): Promise<boolean> {
	const result = await collection().deleteOne({ _id: id });
	return (result.deletedCount ?? 0) > 0;
}

export async function findBatchById(id: string): Promise<StockBatch | null> {
	return collection().findOne({
		_id: new ObjectId(id),
	}) as Promise<StockBatch | null>;
}
