import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { findBrandById } from "../models/brand.model.js";
import {
	type CategoryAttribute,
	findAncestors,
	findCategoryById,
} from "../models/category.model.js";
import {
	createProduct,
	deleteProduct,
	findProductById,
	getProducts,
	type Product,
	type ProductAttribute,
	updateProduct,
} from "../models/product.model.js";
import { findUnitById } from "../models/unit.model.js";
import type { AuthRequest } from "../types/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	CreateProductBody,
	UpdateProductBody,
} from "../validations/product.validation.js";

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

async function collectInheritedAttributes(
	categoryId: string,
): Promise<CategoryAttribute[]> {
	const category = await findCategoryById(categoryId);
	if (!category) return [];

	const ancestors = await findAncestors(categoryId);
	const allCategories = [...ancestors, category];

	const attributes: CategoryAttribute[] = [];
	const seen = new Set<string>();

	for (const cat of allCategories) {
		for (const attr of cat.attributes) {
			if (!seen.has(attr.name)) {
				seen.add(attr.name);
				attributes.push({ ...attr });
			}
		}
	}

	return attributes;
}

function validateAttributes(
	submitted: ProductAttribute[],
	inherited: CategoryAttribute[],
): void {
	// NOTE: here we are making a map to search the attributes object fast with its name
	const inheritedMap = new Map(inherited.map((a) => [a.name, a]));

	for (const attr of submitted) {
		const def = inheritedMap.get(attr.name);
		if (!def) {
			throw new ApiError(
				400,
				"VALIDATION_ERROR",
				`Attribute "${attr.name}" is not valid for this category`,
			);
		}

		if (def.type === "select" && def.possibleValues.length > 0) {
			if (!def.possibleValues.includes(attr.value)) {
				throw new ApiError(
					400,
					"VALIDATION_ERROR",
					`Value "${attr.value}" is not allowed for attribute "${attr.name}". Allowed: ${def.possibleValues.join(", ")}`,
				);
			}
		}
	}

	const requiredAttrs = inherited.filter((a) => a.required);
	const submittedNames = new Set(submitted.map((a) => a.name));
	for (const req of requiredAttrs) {
		if (!submittedNames.has(req.name)) {
			throw new ApiError(
				400,
				"VALIDATION_ERROR",
				`Required attribute "${req.name}" is missing`,
			);
		}
	}
}

export async function createProductHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;
	const body = req.body as CreateProductBody;

	const catId = validateId(body.category, "category");
	const brandId = validateId(body.brand, "brand");
	const unitId = validateId(body.unit, "unit");

	const cat = await findCategoryById(catId);
	if (!cat) {
		throw new ApiError(404, "NOT_FOUND", "Category not found");
	}

	const brandDoc = await findBrandById(brandId);
	if (!brandDoc) {
		throw new ApiError(404, "NOT_FOUND", "Brand not found");
	}

	const unitDoc = await findUnitById(unitId);
	if (!unitDoc) {
		throw new ApiError(404, "NOT_FOUND", "Unit not found");
	}

	const ownerId =
		authReq.user?.role === "ADMIN" && body.owner
			? body.owner
			: (authReq.user?._id ?? "");
	validateId(ownerId, "owner");

	const inheritedAttrs = await collectInheritedAttributes(catId);
	validateAttributes(body.attributes, inheritedAttrs);

	const product = await createProduct({
		category: new ObjectId(catId),
		brand: new ObjectId(brandId),
		unit: new ObjectId(unitId),
		owner: new ObjectId(ownerId),
		buyingPrice: body.buyingPrice,
		attributes: body.attributes,
	});

	return res
		.status(201)
		.json(
			new ApiResponse<Product>(201, product, "Product created successfully"),
		);
}

export async function getProductsHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;

	const search = typeof req.query.search === "string" ? req.query.search : "";
	const barcode =
		typeof req.query.barcode === "string" ? req.query.barcode : "";
	const category =
		typeof req.query.category === "string" ? req.query.category : "";
	const brand = typeof req.query.brand === "string" ? req.query.brand : "";
	const unit = typeof req.query.unit === "string" ? req.query.unit : "";
	const owner = typeof req.query.owner === "string" ? req.query.owner : "";
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const filters: Record<string, string> = {};
	if (authReq.user?.role !== "ADMIN" && authReq.user?._id) {
		filters.owner = authReq.user._id;
	} else if (authReq.user?.role === "ADMIN" && owner) {
		filters.owner = owner;
	}

	const { products, total } = await getProducts({
		search,
		barcode,
		category,
		brand,
		unit,
		...filters,
		page,
		limit,
	});

	return res.status(200).json(
		new ApiResponse<{
			products: Product[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				products,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Products fetched successfully",
		),
	);
}

export async function getProductHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "product ID");

	const product = await findProductById(id);
	if (!product) {
		throw new ApiError(404, "NOT_FOUND", "Product not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<Product>(200, product, "Product fetched successfully"),
		);
}

export async function updateProductHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "product ID");

	const existing = await findProductById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Product not found");
	}

	const body = req.body as UpdateProductBody;
	const update: {
		category?: ObjectId;
		brand?: ObjectId;
		unit?: ObjectId;
		buyingPrice?: number;
		attributes?: ProductAttribute[];
	} = {};

	if (body.category !== undefined) {
		const catId = validateId(body.category, "category");
		const cat = await findCategoryById(catId);
		if (!cat) {
			throw new ApiError(404, "NOT_FOUND", "Category not found");
		}
		update.category = new ObjectId(catId);
	}

	if (body.brand !== undefined) {
		const brandId = validateId(body.brand, "brand");
		const brandDoc = await findBrandById(brandId);
		if (!brandDoc) {
			throw new ApiError(404, "NOT_FOUND", "Brand not found");
		}
		update.brand = new ObjectId(brandId);
	}

	if (body.unit !== undefined) {
		const unitId = validateId(body.unit, "unit");
		const unitDoc = await findUnitById(unitId);
		if (!unitDoc) {
			throw new ApiError(404, "NOT_FOUND", "Unit not found");
		}
		update.unit = new ObjectId(unitId);
	}

	if (body.buyingPrice !== undefined) {
		update.buyingPrice = body.buyingPrice;
	}

	if (body.attributes !== undefined) {
		const catId = body.category ?? existing.category.toString();
		const inheritedAttrs = await collectInheritedAttributes(catId);
		validateAttributes(body.attributes, inheritedAttrs);
		update.attributes = body.attributes;
	}

	const product = await updateProduct(id, update);

	return res
		.status(200)
		.json(
			new ApiResponse<Product>(
				200,
				product as Product,
				"Product updated successfully",
			),
		);
}

export async function deleteProductHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "product ID");

	const existing = await findProductById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Product not found");
	}

	await deleteProduct(id);

	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Product deleted successfully"));
}
