import { z } from "zod";

export const createUnitSchema = z.object({
	name: z.string().min(1).max(100),
	symbol: z.string().min(1).max(20),
});

export const updateUnitSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	symbol: z.string().min(1).max(20).optional(),
});

export type CreateUnitBody = z.infer<typeof createUnitSchema>;
export type UpdateUnitBody = z.infer<typeof updateUnitSchema>;
