import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { findProductById } from "../models/product.model.js";
import {
	createMovement,
	deleteMovement,
	findMovementById,
	getCurrentStock,
	getMovements,
	getProductStockHistory,
	type StockMovement,
} from "../models/stock.model.js";
import {
	type BatchConsumption,
	consumeBatchesFIFO,
	createBatch,
	deleteBatch,
	findBatchById,
	getBatchesByProduct,
	getLatestBatchPrice,
	getProductStockValue,
	restoreBatch,
} from "../models/stock-batch.model.js";
import { findUserById } from "../models/user.model.js";
import type { AuthRequest } from "../types/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type { CreateStockBody } from "../validations/stock.validation.js";

type IdParam = { id: string };
type ProductIdParam = { productId: string };

function validateId(id: string | undefined, label: string): string {
	if (!id || typeof id !== "string") {
		throw new ApiError(400, "BAD_REQUEST", `Missing ${label}`);
	}
	if (!ObjectId.isValid(id)) {
		throw new ApiError(400, "BAD_REQUEST", `Invalid ${label} format`);
	}
	return id;
}

export async function createStockHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;
	const body = req.body as CreateStockBody;

	const productId = validateId(body.product, "product");
	const product = await findProductById(productId);
	if (!product) {
		throw new ApiError(404, "NOT_FOUND", "Product not found");
	}

	const createdBy = new ObjectId(authReq.user?._id ?? "");

	if (body.type === "IN") {
		const batch = await createBatch({
			product: new ObjectId(productId),
			buyingPrice: body.buyingPrice ?? 0,
			initialQty: body.quantity,
			remainingQty: body.quantity,
			createdBy,
		});

		const input: {
			product: ObjectId;
			quantity: number;
			type: "IN";
			buyingPrice: number;
			reason: string;
			reference?: string;
			createdBatchId: ObjectId;
			createdBy: ObjectId;
		} = {
			product: new ObjectId(productId),
			quantity: body.quantity,
			type: "IN",
			buyingPrice: body.buyingPrice ?? 0,
			reason: body.reason,
			createdBatchId: batch._id,
			createdBy,
		};
		if (body.reference !== undefined) input.reference = body.reference;

		const movement = await createMovement(input);

		return res
			.status(201)
			.json(
				new ApiResponse<StockMovement>(
					201,
					movement,
					"Stock movement recorded successfully",
				),
			);
	}

	if (body.type === "OUT") {
		const batchConsumptions = await consumeBatchesFIFO(
			productId,
			body.quantity,
		);

		const input: {
			product: ObjectId;
			quantity: number;
			type: "OUT";
			salePrice: number;
			reason: string;
			reference?: string;
			batchConsumptions: BatchConsumption[];
			createdBy: ObjectId;
		} = {
			product: new ObjectId(productId),
			quantity: body.quantity,
			type: "OUT",
			salePrice: body.salePrice ?? 0,
			reason: body.reason,
			batchConsumptions,
			createdBy,
		};
		if (body.reference !== undefined) input.reference = body.reference;

		const movement = await createMovement(input);

		return res
			.status(201)
			.json(
				new ApiResponse<StockMovement>(
					201,
					movement,
					"Stock movement recorded successfully",
				),
			);
	}

	if (body.type === "ADJUSTMENT") {
		if (body.quantity > 0) {
			const batch = await createBatch({
				product: new ObjectId(productId),
				buyingPrice: body.buyingPrice ?? 0,
				initialQty: body.quantity,
				remainingQty: body.quantity,
				createdBy,
			});

			const input: {
				product: ObjectId;
				quantity: number;
				type: "ADJUSTMENT";
				buyingPrice?: number;
				reason: string;
				reference?: string;
				createdBatchId: ObjectId;
				createdBy: ObjectId;
			} = {
				product: new ObjectId(productId),
				quantity: body.quantity,
				type: "ADJUSTMENT",
				reason: body.reason,
				createdBatchId: batch._id,
				createdBy,
			};
			if (body.buyingPrice !== undefined) input.buyingPrice = body.buyingPrice;
			if (body.reference !== undefined) input.reference = body.reference;

			const movement = await createMovement(input);

			return res
				.status(201)
				.json(
					new ApiResponse<StockMovement>(
						201,
						movement,
						"Stock adjustment recorded successfully",
					),
				);
		}

		const batchConsumptions = await consumeBatchesFIFO(
			productId,
			Math.abs(body.quantity),
		);

		const input: {
			product: ObjectId;
			quantity: number;
			type: "ADJUSTMENT";
			buyingPrice?: number;
			reason: string;
			reference?: string;
			batchConsumptions: BatchConsumption[];
			createdBy: ObjectId;
		} = {
			product: new ObjectId(productId),
			quantity: body.quantity,
			type: "ADJUSTMENT",
			reason: body.reason,
			batchConsumptions,
			createdBy,
		};
		if (body.buyingPrice !== undefined) input.buyingPrice = body.buyingPrice;
		if (body.reference !== undefined) input.reference = body.reference;

		const movement = await createMovement(input);

		return res
			.status(201)
			.json(
				new ApiResponse<StockMovement>(
					201,
					movement,
					"Stock adjustment recorded successfully",
				),
			);
	}

	if (body.type === "TRANSFER") {
		const toOwnerId = validateId(body.toOwner, "toOwner");
		const toUser = await findUserById(toOwnerId);
		if (!toUser) {
			throw new ApiError(404, "NOT_FOUND", "Destination owner not found");
		}

		const batchConsumptions = await consumeBatchesFIFO(
			productId,
			body.quantity,
		);

		const input: {
			product: ObjectId;
			quantity: number;
			type: "OUT";
			reason: string;
			reference?: string;
			toOwner: ObjectId;
			batchConsumptions: BatchConsumption[];
			createdBy: ObjectId;
		} = {
			product: new ObjectId(productId),
			quantity: body.quantity,
			type: "OUT",
			reason: `Transfer to ${toUser.name}`,
			toOwner: new ObjectId(toOwnerId),
			batchConsumptions,
			createdBy,
		};
		if (body.reference !== undefined) input.reference = body.reference;

		const movement = await createMovement(input);

		return res
			.status(201)
			.json(
				new ApiResponse<StockMovement>(
					201,
					movement,
					"Stock transfer recorded successfully",
				),
			);
	}

	throw new ApiError(400, "BAD_REQUEST", "Invalid movement type");
}

export async function getStockMovementsHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;

	const search = typeof req.query.search === "string" ? req.query.search : "";
	const product =
		typeof req.query.product === "string" ? req.query.product : "";
	const type = typeof req.query.type === "string" ? req.query.type : "";
	const owner = typeof req.query.owner === "string" ? req.query.owner : "";
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const filters: {
		search?: string;
		product?: string;
		type?: string;
		owner?: string;
		page?: number;
		limit?: number;
	} = { page, limit };
	if (search) filters.search = search;
	if (product) filters.product = product;
	if (type) filters.type = type;

	if (authReq.user?.role !== "ADMIN" && authReq.user?._id) {
		filters.owner = authReq.user._id;
	} else if (authReq.user?.role === "ADMIN" && owner) {
		filters.owner = owner;
	}

	const { movements, total } = await getMovements(filters);

	return res.status(200).json(
		new ApiResponse<{
			movements: StockMovement[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				movements,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Stock movements fetched successfully",
		),
	);
}

export async function getStockSummaryHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;

	const search = typeof req.query.search === "string" ? req.query.search : "";
	const category =
		typeof req.query.category === "string" ? req.query.category : "";
	const brand = typeof req.query.brand === "string" ? req.query.brand : "";
	const owner = typeof req.query.owner === "string" ? req.query.owner : "";
	const lowStockParam = req.query.lowStock;
	const lowStockThreshold =
		lowStockParam === "true"
			? 0
			: lowStockParam && !Number.isNaN(Number(lowStockParam))
				? Number(lowStockParam)
				: null;
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const productFilters: Record<string, string> = {};
	if (authReq.user?.role !== "ADMIN" && authReq.user?._id) {
		productFilters.owner = authReq.user._id;
	} else if (authReq.user?.role === "ADMIN" && owner) {
		productFilters.owner = owner;
	}

	const { getProducts } = await import("../models/product.model.js");
	const { products, total } = await getProducts({
		search,
		...productFilters,
		category,
		brand,
		page,
		limit,
	});

	const summary = await Promise.all(
		products.map(async (product) => {
			const [currentStock, totalValue, latestBatchPrice] = await Promise.all([
				getCurrentStock(product._id.toString()),
				getProductStockValue(product._id.toString()),
				getLatestBatchPrice(product._id.toString()),
			]);
			return {
				_id: product._id,
				name: product.name,
				barcode: product.barcode,
				category: product.category,
				brand: product.brand,
				unit: product.unit,
				owner: product.owner,
				currentStock,
				totalValue,
				latestBatchPrice,
			};
		}),
	);

	const filtered =
		lowStockThreshold !== null
			? summary.filter((s) => s.currentStock <= lowStockThreshold)
			: summary;

	return res.status(200).json(
		new ApiResponse<{
			summary: typeof filtered;
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				summary: filtered,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Stock summary fetched successfully",
		),
	);
}

export async function getProductStockHistoryHandler(
	req: Request<ProductIdParam>,
	res: Response,
) {
	const productId = validateId(req.params.productId, "product ID");

	const product = await findProductById(productId);
	if (!product) {
		throw new ApiError(404, "NOT_FOUND", "Product not found");
	}

	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const [currentStock, totalValue, batches, { movements, total }] =
		await Promise.all([
			getCurrentStock(productId),
			getProductStockValue(productId),
			getBatchesByProduct(productId),
			getProductStockHistory({ productId, page, limit }),
		]);

	const activeBatches = batches.filter((b) => b.remainingQty > 0);

	return res.status(200).json(
		new ApiResponse<{
			product: { _id: ObjectId; name: string; barcode: string };
			currentStock: number;
			totalValue: number;
			batches: typeof activeBatches;
			movements: StockMovement[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				product: {
					_id: product._id,
					name: product.name,
					barcode: product.barcode,
				},
				currentStock,
				totalValue,
				batches: activeBatches,
				movements,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Product stock history fetched successfully",
		),
	);
}

export async function deleteStockHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "stock movement ID");

	const movement = await findMovementById(id);
	if (!movement) {
		throw new ApiError(404, "NOT_FOUND", "Stock movement not found");
	}

	if (
		movement.type === "IN" ||
		(movement.type === "ADJUSTMENT" && (movement.quantity ?? 0) > 0)
	) {
		if (movement.createdBatchId) {
			const batch = await findBatchById(movement.createdBatchId.toString());
			if (batch && batch.remainingQty < batch.initialQty) {
				throw new ApiError(
					400,
					"BATCH_CONSUMED",
					"Cannot delete: stock from this batch has been consumed by other movements",
				);
			}
			if (batch) {
				await deleteBatch(batch._id);
			}
		}
	}

	if (movement.batchConsumptions && movement.batchConsumptions.length > 0) {
		for (const consumption of movement.batchConsumptions) {
			await restoreBatch(consumption.batchId, consumption.quantity);
		}
	}

	const deleted = await deleteMovement(id);
	if (!deleted) {
		throw new ApiError(404, "NOT_FOUND", "Stock movement not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<null>(200, null, "Stock movement deleted successfully"),
		);
}
