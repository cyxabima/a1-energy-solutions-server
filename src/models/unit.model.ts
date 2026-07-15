import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export interface Unit {
	_id: ObjectId;
	name: string;
	symbol: string;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateUnitInput = Omit<Unit, "_id" | "createdAt" | "updatedAt">;
export type UpdateUnitInput = Partial<Pick<Unit, "name" | "symbol">>;

function collection(): Collection<OptionalId<Unit>> {
	return getDb().collection<OptionalId<Unit>>("units");
}

export async function ensureIndexes(): Promise<void> {
	await collection().createIndex({ name: 1 }, { unique: true });
}

export async function createUnit(data: CreateUnitInput): Promise<Unit> {
	const now = new Date();
	const doc: OptionalId<Unit> = {
		...data,
		name: data.name.trim(),
		symbol: data.symbol.trim(),
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Unit;
}

export async function findUnitById(id: string): Promise<Unit | null> {
	return collection().findOne({ _id: new ObjectId(id) });
}

export async function findUnitByName(name: string): Promise<Unit | null> {
	return collection().findOne({ name: name.trim() });
}

export async function getAllUnits(): Promise<Unit[]> {
	return collection().find({}).sort({ name: 1 }).toArray() as Promise<Unit[]>;
}

export async function updateUnit(
	id: string,
	data: UpdateUnitInput,
): Promise<Unit | null> {
	const update: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) update.name = data.name.trim();
	if (data.symbol !== undefined) update.symbol = data.symbol.trim();

	return collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	) as Promise<Unit | null>;
}

export async function deleteUnit(id: string): Promise<boolean> {
	const result = await collection().deleteOne({ _id: new ObjectId(id) });
	return (result.deletedCount ?? 0) > 0;
}
