import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";
import { findAncestors, findCategoryById } from "./category.model.js";

export interface ProductAttribute {
	name: string;
	value: string;
}

export interface Product {
	_id: ObjectId;
	name: string;
	barcode: string;
	category: ObjectId;
	brand: ObjectId;
	unit: ObjectId;
	owner: ObjectId;
	buyingPrice: number;
	attributes: ProductAttribute[];
	createdAt: Date;
	updatedAt: Date;
}

export type CreateProductInput = Omit<
	Product,
	"_id" | "name" | "barcode" | "createdAt" | "updatedAt"
> & {
	attributes: ProductAttribute[];
};

export type UpdateProductInput = Partial<
	Pick<Product, "category" | "brand" | "unit" | "buyingPrice" | "attributes">
>;

function collection(): Collection<OptionalId<Product>> {
	return getDb().collection<OptionalId<Product>>("products");
}

function countersCollection(): Collection<{ _id: string; seq: number }> {
	return getDb().collection<{ _id: string; seq: number }>("counters");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ barcode: 1 }, { unique: true });
	await col.createIndex({ name: 1 });
	await col.createIndex({ category: 1 });
	await col.createIndex({ brand: 1 });
	await col.createIndex({ unit: 1 });
	await col.createIndex({ owner: 1 });
}

async function generateBarcode(): Promise<string> {
	const counter = await countersCollection().findOneAndUpdate(
		{ _id: "product_barcode" },
		{ $inc: { seq: 1 } },
		{ upsert: true, returnDocument: "after" },
	);

	const seq = counter?.seq ?? 1;
	return `A1E-${String(seq).padStart(6, "0")}`;
}

export function generateProductName(
	categoryNames: string[],
	attributes: ProductAttribute[],
): string {
	return [...categoryNames, ...attributes.map((a) => a.value)].join(" ");
}

export async function createProduct(
	data: CreateProductInput,
): Promise<Product> {
	const now = new Date();

	const ancestors = await findAncestors(data.category.toString());
	const category = await findCategoryById(data.category.toString());
	const categoryNames = [...ancestors.map((c) => c.name), category?.name ?? ""];
	const name = generateProductName(categoryNames, data.attributes);
	const barcode = await generateBarcode();

	const doc: OptionalId<Product> = {
		...data,
		name,
		barcode,
		category: data.category,
		brand: data.brand,
		unit: data.unit,
		owner: data.owner,
		buyingPrice: data.buyingPrice,
		attributes: data.attributes,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Product;
}

export async function findProductById(id: string): Promise<Product | null> {
	return collection().findOne({ _id: new ObjectId(id) });
}

export async function findProductByBarcode(
	barcode: string,
): Promise<Product | null> {
	return collection().findOne({ barcode });
}

export async function getProducts(params: {
	search?: string;
	barcode?: string;
	owner?: string;
	category?: string;
	brand?: string;
	unit?: string;
	page?: number;
	limit?: number;
}): Promise<{ products: Product[]; total: number }> {
	const query: Record<string, unknown> = {};

	if (params.search) {
		query.name = { $regex: params.search, $options: "i" };
	}
	if (params.barcode) {
		query.barcode = params.barcode;
	}
	if (params.owner) query.owner = new ObjectId(params.owner);
	if (params.category) query.category = new ObjectId(params.category);
	if (params.brand) query.brand = new ObjectId(params.brand);
	if (params.unit) query.unit = new ObjectId(params.unit);

	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const [products, total] = await Promise.all([
		collection()
			.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray(),
		collection().countDocuments(query),
	]);

	return { products: products as Product[], total };
}

export async function updateProduct(
	id: string,
	data: UpdateProductInput,
): Promise<Product | null> {
	const existing = await collection().findOne({ _id: new ObjectId(id) });
	if (!existing) return null;

	const update: Record<string, unknown> = { updatedAt: new Date() };

	if (data.category !== undefined) update.category = data.category;
	if (data.brand !== undefined) update.brand = data.brand;
	if (data.unit !== undefined) update.unit = data.unit;
	if (data.buyingPrice !== undefined) update.buyingPrice = data.buyingPrice;
	if (data.attributes !== undefined) {
		update.attributes = data.attributes;
	}

	if (data.attributes !== undefined || data.category !== undefined) {
		const catId = (data.category ?? existing.category).toString();
		const ancestors = await findAncestors(catId);
		const categoryDoc = await findCategoryById(catId);
		const categoryNames = [
			...ancestors.map((c) => c.name),
			categoryDoc?.name ?? "",
		];
		const attrs = data.attributes ?? existing.attributes;
		update.name = generateProductName(categoryNames, attrs);
	}

	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	) as Promise<Product | null>;
}

export async function deleteProduct(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}
