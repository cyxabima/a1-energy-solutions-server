import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export type UserRole = "ADMIN" | "OWNER" | "STAFF";

export interface User {
	_id: ObjectId;
	name: string;
	email: string;
	password: string;
	role: UserRole;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateUserInput = Omit<User, "_id" | "createdAt" | "updatedAt">;
export type SafeUser = Omit<User, "_id" | "password"> & { _id: string };

function collection(): Collection<OptionalId<User>> {
	return getDb().collection<OptionalId<User>>("users");
}

export async function createUser(data: CreateUserInput): Promise<SafeUser> {
	const now = new Date();
	const doc: OptionalId<User> = {
		...data,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	const user: SafeUser = {
		...doc,
		_id: result.insertedId.toString(),
	} as SafeUser;
	return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
	return collection().findOne({ email: email.toLowerCase() });
}

export async function findUserById(id: string): Promise<User | null> {
	const { ObjectId } = await import("mongodb");
	return collection().findOne({ _id: new ObjectId(id) });
}

export function toSafeUser(user: User): SafeUser {
	const { password: _, ...rest } = user;
	return { ...rest, _id: rest._id.toString() };
}

export async function getUsers(params: {
	search?: string;
	role?: string;
	page?: number;
	limit?: number;
}): Promise<{ users: SafeUser[]; total: number }> {
	const query: Record<string, unknown> = {};
	if (params.search) {
		query.$or = [
			{ name: { $regex: params.search, $options: "i" } },
			{ email: { $regex: params.search, $options: "i" } },
		];
	}
	if (params.role) query.role = params.role;

	const page = Math.max(1, params.page ?? 1);
	const limit = Math.min(100, Math.max(1, params.limit ?? 20));
	const skip = (page - 1) * limit;

	const [users, total] = await Promise.all([
		collection()
			.find(query)
			.project({ password: 0 })
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray(),
		collection().countDocuments(query),
	]);

	return { users: users as SafeUser[], total };
}

export async function updateUser(
	id: string,
	data: { name?: string; email?: string; role?: string },
): Promise<SafeUser | null> {
	const update: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) update.name = data.name;
	if (data.email !== undefined) update.email = data.email.toLowerCase();
	if (data.role !== undefined) update.role = data.role;

	const result = await collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	);
	if (!result) return null;
	return toSafeUser(result as User);
}

export async function updatePassword(
	id: string,
	hashedPassword: string,
): Promise<boolean> {
	const result = await collection().updateOne(
		{ _id: new ObjectId(id) },
		{ $set: { password: hashedPassword, updatedAt: new Date() } },
	);
	return result.modifiedCount > 0;
}
