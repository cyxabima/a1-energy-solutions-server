import type { Collection, ObjectId, OptionalId } from "mongodb";
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
