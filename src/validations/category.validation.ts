import { z } from "zod";

const attributeSchema = z.object({
	name: z.string().min(1).max(100),
	type: z.enum(["select", "text", "number"]),
	required: z.boolean(),
	possibleValues: z.array(z.string().min(1).max(200)).default([]),
});

export const createCategorySchema = z.object({
	name: z.string().min(2).max(100),
	parentId: z.string().optional(),
	attributes: z.array(attributeSchema).default([]),
});

export const updateCategorySchema = z.object({
	name: z.string().min(2).max(100).optional(),
	attributes: z.array(attributeSchema).optional(),
});

export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
