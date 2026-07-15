import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
	createUnit,
	deleteUnit,
	findUnitById,
	findUnitByName,
	getAllUnits,
	type Unit,
	type UpdateUnitInput,
	updateUnit,
} from "../models/unit.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	CreateUnitBody,
	UpdateUnitBody,
} from "../validations/unit.validation.js";

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

export async function createUnitHandler(req: Request, res: Response) {
	const { name, symbol } = req.body as CreateUnitBody;

	const existing = await findUnitByName(name);
	if (existing) {
		throw new ApiError(409, "CONFLICT", "Unit already exists");
	}

	const unit = await createUnit({ name, symbol });

	return res
		.status(201)
		.json(new ApiResponse<Unit>(201, unit, "Unit created successfully"));
}

export async function getUnitsHandler(_req: Request, res: Response) {
	const units = await getAllUnits();

	return res
		.status(200)
		.json(new ApiResponse<Unit[]>(200, units, "Units fetched successfully"));
}

export async function getUnitHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "unit ID");

	const unit = await findUnitById(id);
	if (!unit) {
		throw new ApiError(404, "NOT_FOUND", "Unit not found");
	}

	return res
		.status(200)
		.json(new ApiResponse<Unit>(200, unit, "Unit fetched successfully"));
}

export async function updateUnitHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "unit ID");

	const existing = await findUnitById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Unit not found");
	}

	const body = req.body as UpdateUnitBody;
	if (body.name && body.name !== existing.name) {
		const duplicate = await findUnitByName(body.name);
		if (duplicate) {
			throw new ApiError(409, "CONFLICT", "Unit name already exists");
		}
	}

	const update: UpdateUnitInput = {};
	if (body.name !== undefined) update.name = body.name;
	if (body.symbol !== undefined) update.symbol = body.symbol;
	const unit = await updateUnit(id, update);

	return res
		.status(200)
		.json(
			new ApiResponse<Unit>(200, unit as Unit, "Unit updated successfully"),
		);
}

export async function deleteUnitHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "unit ID");

	const existing = await findUnitById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Unit not found");
	}

	await deleteUnit(id);

	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Unit deleted successfully"));
}
