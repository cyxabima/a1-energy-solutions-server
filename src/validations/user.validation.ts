import { z } from "zod";

export const updateUserSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	email: z.email().optional(),
	role: z.enum(["ADMIN", "OWNER", "STAFF"]).optional(),
});

export type UpdateUserBody = z.infer<typeof updateUserSchema>;
