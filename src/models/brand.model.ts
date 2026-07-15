import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export interface Brand {
	_id: ObjectId;
	name: string;
	description: string;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateBrandInput = Omit<Brand, "_id" | "createdAt" | "updatedAt">;
export type UpdateBrandInput = Partial<Pick<Brand, "name" | "description">>;

function collection(): Collection<OptionalId<Brand>> {
	return getDb().collection<OptionalId<Brand>>("brands");
}

export async function ensureIndexes(): Promise<void> {
	await collection().createIndex({ name: 1 }, { unique: true });
}

export async function createBrand(data: CreateBrandInput): Promise<Brand> {
	const now = new Date();
	const doc: OptionalId<Brand> = {
		...data,
		name: data.name.trim(),
		description: data.description?.trim() ?? "",
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Brand;
}

export async function findBrandById(id: string): Promise<Brand | null> {
	return collection().findOne({ _id: new ObjectId(id) });
}

export async function findBrandByName(name: string): Promise<Brand | null> {
	return collection().findOne({ name: name.trim() });
}

export async function getAllBrands(): Promise<Brand[]> {
	return collection().find({}).sort({ name: 1 }).toArray() as Promise<Brand[]>;
}

export async function updateBrand(
	id: string,
	data: UpdateBrandInput,
): Promise<Brand | null> {
	const update: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) update.name = data.name.trim();
	if (data.description !== undefined)
		update.description = data.description.trim();

	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	) as Promise<Brand | null>;
}

export async function deleteBrand(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}
