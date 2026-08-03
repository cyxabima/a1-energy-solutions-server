import { z } from "zod";

export const createUserSchema = z.object({
	name: z.string().min(2).max(100),
	email: z.email(),
	password: z.string().min(6).max(128),
	role: z.enum(["ADMIN", "OWNER", "STAFF"]),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	email: z.email().optional(),
	role: z.enum(["ADMIN", "OWNER", "STAFF"]).optional(),
});

export type UpdateUserBody = z.infer<typeof updateUserSchema>;
