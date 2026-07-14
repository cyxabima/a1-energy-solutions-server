import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export interface CategoryAttribute {
	name: string;
	type: "select" | "text" | "number";
	required: boolean;
	possibleValues: string[];
}

export interface Category {
	_id: ObjectId;
	name: string;
	slug: string;
	path: string;
	depth: number;
	parentId: ObjectId | null;
	attributes: CategoryAttribute[];
	createdBy: ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateCategoryInput = Omit<
	Category,
	"_id" | "slug" | "path" | "depth" | "createdAt" | "updatedAt"
>;
export type UpdateCategoryInput = {
	name?: string;
	attributes?: CategoryAttribute[];
};

function collection(): Collection<OptionalId<Category>> {
	return getDb().collection<OptionalId<Category>>("categories");
}

function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

// NOTE: Just like a escape sequence charcheter we are escaping some charcheters that are part of regex so that new Regx in the other function doesnot break
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function ensureIndexes(): Promise<void> {
	const col = collection();
	await col.createIndex({ path: 1 });
	await col.createIndex({ parentId: 1 });
	await col.createIndex({ slug: 1, parentId: 1 }, { unique: true });
}

export async function createCategory(
	data: CreateCategoryInput,
): Promise<Category> {
	const now = new Date();
	const slug = toSlug(data.name);

	let path: string;
	let depth: number;

	if (data.parentId) {
		const parent = await collection().findOne({ _id: data.parentId });
		if (!parent) {
			throw new Error("Parent category not found");
		}
		path = `${parent.path}${slug},`;
		depth = parent.depth + 1;
	} else {
		path = `,${slug},`;
		depth = 0;
	}

	const doc: OptionalId<Category> = {
		name: data.name,
		slug,
		path,
		depth,
		parentId: data.parentId ?? null,
		attributes: data.attributes ?? [],
		createdBy: data.createdBy,
		createdAt: now,
		updatedAt: now,
	};

	const result = await collection().insertOne(doc);
	return { ...doc, _id: result.insertedId } as Category;
}

export async function findCategoryById(id: string): Promise<Category | null> {
	return collection().findOne({ _id: new ObjectId(id) });
}

export async function findDirectChildren(
	parentId: string,
): Promise<Category[]> {
	const parent = await collection().findOne({ _id: new ObjectId(parentId) });
	if (!parent) return [];

	const escapedPath = escapeRegex(parent.path);
	return collection()
		.find({ path: { $regex: new RegExp(`${escapedPath}[^,]+,$`) } }) //find the path which start from , and end on , and there is no , in between so exactly one children
		.sort({ name: 1 })
		.toArray() as Promise<Category[]>;
}

export async function findDescendants(id: string): Promise<Category[]> {
	const node = await collection().findOne({ _id: new ObjectId(id) });
	if (!node) return [];

	const escapedPath = escapeRegex(node.path);
	return collection()
		.find({
			path: { $regex: new RegExp(`^${escapedPath}`) },
			_id: { $ne: node._id },
		})
		.sort({ depth: 1, name: 1 })
		.toArray() as Promise<Category[]>;
}

export async function findAncestors(id: string): Promise<Category[]> {
	const node = await collection().findOne({ _id: new ObjectId(id) });
	if (!node) return [];

	const ancestorSlugs = node.path.split(",").filter(Boolean).slice(0, -1);

	if (ancestorSlugs.length === 0) return [];

	const ancestors = (await collection()
		.find({ slug: { $in: ancestorSlugs } })
		.toArray()) as Category[];

	return ancestorSlugs
		.map((slug) => ancestors.find((a) => a.slug === slug))
		.filter(Boolean) as Category[];
}

export async function getFullTree(): Promise<Category[]> {
	const all = (await collection()
		.find({})
		.sort({ path: 1 })
		.toArray()) as Category[];
	return all;
}

export async function getAllFlat(): Promise<Category[]> {
	return collection().find({}).sort({ path: 1 }).toArray() as Promise<
		Category[]
	>;
}

export async function updateCategory(
	id: string,
	data: UpdateCategoryInput,
): Promise<Category | null> {
	const update: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) {
		update.name = data.name;
		update.slug = toSlug(data.name);
	}

	if (data.attributes !== undefined) {
		update.attributes = data.attributes;
	}

	const result = await collection().findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: update },
		{ returnDocument: "after" },
	);

	return result as Category | null;
}

export async function deleteCategory(id: string): Promise<number> {
	const node = await collection().findOne({ _id: new ObjectId(id) });
	if (!node) return 0;

	const escapedPath = escapeRegex(node.path);
	const result = await collection().deleteMany({
		path: { $regex: new RegExp(`^${escapedPath}`) },
	});

	return result.deletedCount ?? 0;
}
