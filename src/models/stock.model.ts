import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";
import type { BatchConsumption } from "./stock-batch.model.js";

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER";

export interface StockMovement {
	_id: ObjectId;
	product: ObjectId;
	quantity: number;
	type: StockMovementType;
	buyingPrice?: number;
	salePrice?: number;
	reason: string;
	reference?: string;
	toOwner?: ObjectId;
	createdBatchId?: ObjectId;
	batchConsumptions?: BatchConsumption[];
	createdBy: ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateStockMovementInput = {
	product: ObjectId;
	quantity: number;
	type: StockMovementType;
	buyingPrice?: number;
	salePrice?: number;
	reason: string;
	reference?: string;
	toOwner?: ObjectId;
	createdBatchId?: ObjectId;
	batchConsumptions?: BatchConsumption[];
	createdBy: ObjectId;
};

function collection(): Collection<OptionalId<StockMovement>> {
	return getDb().collection<OptionalId<StockMovement>>("stock_movements");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ product: 1, createdAt: -1 });
	await col.createIndex({ type: 1 });
	await col.createIndex({ createdBy: 1 });
	await col.createIndex({ createdBatchId: 1 });
	await col.createIndex({ "batchConsumptions.batchId": 1 });
}

export async function createMovement(
	data: CreateStockMovementInput,
): Promise<StockMovement> {
	const now = new Date();
	const doc: OptionalId<StockMovement> = {
		...data,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as StockMovement;
}

export async function createMovements(
	docs: CreateStockMovementInput[],
): Promise<StockMovement[]> {
	const now = new Date();
	const docsToInsert: OptionalId<StockMovement>[] = docs.map((d) => ({
		...d,
		createdAt: now,
		updatedAt: now,
	}));

	const result = await collection().insertMany(docsToInsert);
	return docsToInsert.map((doc, i) => ({
		...doc,
		_id: result.insertedIds[i] ?? new ObjectId(),
	})) as StockMovement[];
}

export async function getCurrentStock(productId: string): Promise<number> {
	const pipeline = [
		{ $match: { product: new ObjectId(productId) } },
		{
			$group: {
				_id: null,
				stock: {
					$sum: {
						$switch: {
							branches: [
								// biome-ignore lint/suspicious/noThenProperty: MongoDB
								{ case: { $eq: ["$type", "IN"] }, then: "$quantity" },
								{
									case: { $eq: ["$type", "OUT"] },
									// biome-ignore lint/suspicious/noThenProperty: MongoDB
									then: { $multiply: ["$quantity", -1] },
								},
								// biome-ignore lint/suspicious/noThenProperty: MongoDB
								{ case: { $eq: ["$type", "ADJUSTMENT"] }, then: "$quantity" },
							],
							default: 0,
						},
					},
				},
			},
		},
	];

	const results = await collection().aggregate(pipeline).toArray();
	return (results[0] as { stock?: number } | undefined)?.stock ?? 0;
}

export async function getMovements(params: {
	search?: string;
	product?: string;
	type?: string;
	owner?: string;
	page?: number;
	limit?: number;
}): Promise<{ movements: StockMovement[]; total: number }> {
	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const pipeline: Record<string, unknown>[] = [];

	if (params.owner) {
		pipeline.push(
			{
				$lookup: {
					from: "products",
					localField: "product",
					foreignField: "_id",
					as: "productDoc",
				},
			},
			{ $unwind: "$productDoc" },
			{ $match: { "productDoc.owner": new ObjectId(params.owner) } },
		);
	}

	const matchStage: Record<string, unknown> = {};
	if (params.search) {
		matchStage.reason = { $regex: params.search, $options: "i" };
	}
	if (params.product) {
		matchStage.product = new ObjectId(params.product);
	}
	if (params.type) {
		matchStage.type = params.type;
	}
	if (Object.keys(matchStage).length > 0) {
		pipeline.push({ $match: matchStage });
	}

	pipeline.push(
		{
			$lookup: {
				from: "products",
				localField: "product",
				foreignField: "_id",
				as: "productDoc",
			},
		},
		{ $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: "users",
				localField: "toOwner",
				foreignField: "_id",
				as: "toOwnerDoc",
			},
		},
		{
			$unwind: {
				path: "$toOwnerDoc",
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
				product: {
					_id: "$productDoc._id",
					name: "$productDoc.name",
					barcode: "$productDoc.barcode",
				},
				quantity: 1,
				type: 1,
				buyingPrice: 1,
				salePrice: 1,
				reason: 1,
				reference: 1,
				toOwner: {
					$cond: {
						if: {
							$gt: [{ $size: { $ifNull: ["$toOwnerDoc", []] } }, 0],
						},
						// biome-ignore lint/suspicious/noThenProperty: MongoDB
						then: {
							_id: { $arrayElemAt: ["$toOwnerDoc._id", 0] },
							name: { $arrayElemAt: ["$toOwnerDoc.name", 0] },
						},
						else: null,
					},
				},
				createdBatchId: 1,
				batchConsumptions: 1,
				createdBy: {
					_id: "$createdByDoc._id",
					name: "$createdByDoc.name",
				},
				createdAt: 1,
			},
		},
		{ $sort: { createdAt: -1 } },
	);

	const countPipeline = [...pipeline, { $count: "total" }];
	const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

	const [countResult, movements] = await Promise.all([
		collection().aggregate(countPipeline).toArray(),
		collection().aggregate(dataPipeline).toArray(),
	]);

	const total = (countResult[0] as { total?: number } | undefined)?.total ?? 0;

	return {
		movements: movements as unknown as StockMovement[],
		total,
	};
}

export async function getProductStockHistory(params: {
	productId: string;
	page?: number;
	limit?: number;
}): Promise<{ movements: StockMovement[]; total: number }> {
	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const match = { product: new ObjectId(params.productId) };

	const pipeline: Record<string, unknown>[] = [
		{ $match: match },
		{
			$lookup: {
				from: "users",
				localField: "toOwner",
				foreignField: "_id",
				as: "toOwnerDoc",
			},
		},
		{
			$unwind: {
				path: "$toOwnerDoc",
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
				quantity: 1,
				type: 1,
				buyingPrice: 1,
				salePrice: 1,
				reason: 1,
				reference: 1,
				toOwner: {
					$cond: {
						if: {
							$gt: [{ $size: { $ifNull: ["$toOwnerDoc", []] } }, 0],
						},
						// biome-ignore lint/suspicious/noThenProperty: MongoDB
						then: {
							_id: { $arrayElemAt: ["$toOwnerDoc._id", 0] },
							name: { $arrayElemAt: ["$toOwnerDoc.name", 0] },
						},
						else: null,
					},
				},
				createdBatchId: 1,
				batchConsumptions: 1,
				createdBy: {
					_id: "$createdByDoc._id",
					name: "$createdByDoc.name",
				},
				createdAt: 1,
			},
		},
		{ $sort: { createdAt: -1 } },
	];

	const countPipeline = [{ $match: match }, { $count: "total" }];
	const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

	const [countResult, movements] = await Promise.all([
		collection().aggregate(countPipeline).toArray(),
		collection().aggregate(dataPipeline).toArray(),
	]);

	const total = (countResult[0] as { total?: number } | undefined)?.total ?? 0;

	return {
		movements: movements as unknown as StockMovement[],
		total,
	};
}

export async function deleteMovement(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}

export async function findMovementById(
	id: string,
): Promise<StockMovement | null> {
	return collection().findOne({
		_id: new ObjectId(id),
	}) as Promise<StockMovement | null>;
}
