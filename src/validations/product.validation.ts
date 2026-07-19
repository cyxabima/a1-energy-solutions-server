import { z } from "zod";

const productAttributeSchema = z.object({
	name: z.string().min(1).max(100),
	value: z.string().min(1).max(200),
});

export const createProductSchema = z.object({
	category: z.string(),
	brand: z.string(),
	unit: z.string(),
	attributes: z.array(productAttributeSchema).min(1),
	owner: z.string().optional(),
});

export const updateProductSchema = z.object({
	category: z.string().optional(),
	brand: z.string().optional(),
	unit: z.string().optional(),
	attributes: z.array(productAttributeSchema).optional(),
});

export type CreateProductBody = z.infer<typeof createProductSchema>;
export type UpdateProductBody = z.infer<typeof updateProductSchema>;
