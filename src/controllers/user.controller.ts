import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
	findUserByEmail,
	getUsers,
	type SafeUser,
	updateUser,
} from "../models/user.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type { UpdateUserBody } from "../validations/user.validation.js";

type IdParam = { id: string };

function validateId(id: string | undefined, label: string): string {
	if (!id || typeof id !== "string") {
		throw new ApiError(400, "BAD_REQUEST", `Missing ${label}`);
	}
	if (!ObjectId.isValid(id)) {
		throw new ApiError(400, "BAD_REQUEST", `Invalid ${label} format`);
	}
	return id;
}

export async function getUsersHandler(req: Request, res: Response) {
	const search = typeof req.query.search === "string" ? req.query.search : "";
	const role = typeof req.query.role === "string" ? req.query.role : "";
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const { users, total } = await getUsers({ search, role, page, limit });

	return res.status(200).json(
		new ApiResponse<{
			users: SafeUser[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				users,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Users fetched successfully",
		),
	);
}

export async function updateUserHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "user ID");
	const body = req.body as UpdateUserBody;

	if (body.email) {
		const existing = await findUserByEmail(body.email);
		if (existing && existing._id.toString() !== id) {
			throw new ApiError(409, "CONFLICT", "Email already in use");
		}
	}

	const update: { name?: string; email?: string; role?: string } = {};
	if (body.name !== undefined) update.name = body.name;
	if (body.email !== undefined) update.email = body.email;
	if (body.role !== undefined) update.role = body.role;

	const user = await updateUser(id, update);
	if (!user) {
		throw new ApiError(404, "NOT_FOUND", "User not found");
	}

	return res
		.status(200)
		.json(new ApiResponse<SafeUser>(200, user, "User updated successfully"));
}
