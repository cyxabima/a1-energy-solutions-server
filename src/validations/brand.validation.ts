import { z } from "zod";

export const createBrandSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

export const updateBrandSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
});

export type CreateBrandBody = z.infer<typeof createBrandSchema>;
export type UpdateBrandBody = z.infer<typeof updateBrandSchema>;
