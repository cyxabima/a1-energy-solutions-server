import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
	type Brand,
	createBrand,
	deleteBrand,
	findBrandById,
	findBrandByName,
	getAllBrands,
	type UpdateBrandInput,
	updateBrand,
} from "../models/brand.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	CreateBrandBody,
	UpdateBrandBody,
} from "../validations/brand.validation.js";

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

export async function createBrandHandler(req: Request, res: Response) {
	const { name, description } = req.body as CreateBrandBody;

	const existing = await findBrandByName(name);
	if (existing) {
		throw new ApiError(409, "CONFLICT", "Brand already exists");
	}

	const brand = await createBrand({
		name,
		description: description ?? "",
	});

	return res
		.status(201)
		.json(new ApiResponse<Brand>(201, brand, "Brand created successfully"));
}

export async function getBrandsHandler(_req: Request, res: Response) {
	const brands = await getAllBrands();

	return res
		.status(200)
		.json(new ApiResponse<Brand[]>(200, brands, "Brands fetched successfully"));
}

export async function getBrandHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "brand ID");

	const brand = await findBrandById(id);
	if (!brand) {
		throw new ApiError(404, "NOT_FOUND", "Brand not found");
	}

	return res
		.status(200)
		.json(new ApiResponse<Brand>(200, brand, "Brand fetched successfully"));
}

export async function updateBrandHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "brand ID");

	const existing = await findBrandById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Brand not found");
	}

	const body = req.body as UpdateBrandBody;
	if (body.name && body.name !== existing.name) {
		const duplicate = await findBrandByName(body.name);
		if (duplicate) {
			throw new ApiError(409, "CONFLICT", "Brand name already exists");
		}
	}

	const update: UpdateBrandInput = {};
	if (body.name !== undefined) update.name = body.name;
	if (body.description !== undefined) update.description = body.description;
	const brand = await updateBrand(id, update);

	return res
		.status(200)
		.json(
			new ApiResponse<Brand>(200, brand as Brand, "Brand updated successfully"),
		);
}

export async function deleteBrandHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "brand ID");

	const existing = await findBrandById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Brand not found");
	}

	await deleteBrand(id);

	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Brand deleted successfully"));
}
