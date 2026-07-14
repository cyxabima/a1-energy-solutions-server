import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
	type Category,
	type CategoryAttribute,
	createCategory,
	deleteCategory,
	findAncestors,
	findCategoryById,
	getFullTree,
	type UpdateCategoryInput,
	updateCategory,
} from "../models/category.model.js";
import type { AuthRequest } from "../types/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	CreateCategoryBody,
	UpdateCategoryBody,
} from "../validations/category.validation.js";

interface TreeNode extends Category {
	children: TreeNode[];
}

type IdParam = { id: string };

/* basiclly here i am building tree using a map for the categories array i am making a maping id with single category so that search is O(1) as for adding children i first need to search that if category has parent id i will have to search that node in the map so that i can insert that categories in the parent of childern if there is parent other wise it is a root so insert them in root node list so we have found the roots */

function buildTree(categories: Category[]): TreeNode[] {
	const map = new Map<string, TreeNode>();
	const roots: TreeNode[] = [];

	for (const cat of categories) {
		const id = cat._id.toString();
		map.set(id, { ...cat, children: [] });
	}

	for (const cat of categories) {
		const id = cat._id.toString();
		const node = map.get(id);
		if (!node) continue;

		if (cat.parentId) {
			const parentId = cat.parentId.toString();
			const parent = map.get(parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	return roots;
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

function validateId(id: string | undefined, label: string): string {
	if (!id || typeof id !== "string") {
		throw new ApiError(400, "BAD_REQUEST", `Missing ${label}`);
	}
	if (!ObjectId.isValid(id)) {
		throw new ApiError(400, "BAD_REQUEST", `Invalid ${label} format`);
	}
	return id;
}

export async function createCategoryHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;
	const { name, parentId, attributes } = req.body as CreateCategoryBody;

	let parentObjectId: ObjectId | null = null;
	if (parentId) {
		validateId(parentId, "parentId");
		parentObjectId = new ObjectId(parentId);
	}

	const category = await createCategory({
		name,
		parentId: parentObjectId,
		attributes: attributes ?? [],
		createdBy: new ObjectId(authReq.user?._id ?? ""),
	});

	return res
		.status(201)
		.json(
			new ApiResponse<Category>(201, category, "Category created successfully"),
		);
}

export async function getTreeHandler(_req: Request, res: Response) {
	const all = await getFullTree();
	const tree = buildTree(all);

	return res
		.status(200)
		.json(
			new ApiResponse<TreeNode[]>(
				200,
				tree,
				"Category tree fetched successfully",
			),
		);
}

export async function getCategoriesHandler(_req: Request, res: Response) {
	const all = await getFullTree();

	return res
		.status(200)
		.json(
			new ApiResponse<Category[]>(200, all, "Categories fetched successfully"),
		);
}

export async function getCategoryHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "category ID");

	const category = await findCategoryById(id);
	if (!category) {
		throw new ApiError(404, "NOT_FOUND", "Category not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<Category>(200, category, "Category fetched successfully"),
		);
}

export async function getCategoryAttributesHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "category ID");

	const category = await findCategoryById(id);
	if (!category) {
		throw new ApiError(404, "NOT_FOUND", "Category not found");
	}

	const ancestors = await findAncestors(id);
	const attributes = await collectInheritedAttributes(id);

	return res.status(200).json(
		new ApiResponse<{
			categoryId: string;
			categoryName: string;
			ancestors: string[];
			attributes: CategoryAttribute[];
		}>(
			200,
			{
				categoryId: id,
				categoryName: category.name,
				ancestors: ancestors.map((a) => a.name),
				attributes,
			},
			"Category attributes fetched successfully",
		),
	);
}

export async function getAncestorsHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "category ID");

	const category = await findCategoryById(id);
	if (!category) {
		throw new ApiError(404, "NOT_FOUND", "Category not found");
	}

	const ancestors = await findAncestors(id);

	return res
		.status(200)
		.json(
			new ApiResponse<Category[]>(
				200,
				ancestors,
				"Ancestors fetched successfully",
			),
		);
}

export async function updateCategoryHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "category ID");

	const existing = await findCategoryById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Category not found");
	}

	const body = req.body as UpdateCategoryBody;
	const update: UpdateCategoryInput = {};
	if (body.name !== undefined) update.name = body.name;
	if (body.attributes !== undefined) update.attributes = body.attributes;
	const category = await updateCategory(id, update);

	return res
		.status(200)
		.json(
			new ApiResponse<Category>(
				200,
				category as Category,
				"Category updated successfully",
			),
		);
}

export async function deleteCategoryHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "category ID");

	const existing = await findCategoryById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Category not found");
	}

	const deletedCount = await deleteCategory(id);

	return res
		.status(200)
		.json(
			new ApiResponse<{ deletedCount: number }>(
				200,
				{ deletedCount },
				"Category deleted successfully",
			),
		);
}
