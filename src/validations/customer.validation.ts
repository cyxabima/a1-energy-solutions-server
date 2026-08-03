import { z } from "zod";

export const customerTypes = ["CASH", "RETAILER", "CONTRACTOR"] as const;

export const createCustomerSchema = z.object({
	name: z.string().min(1).max(200),
	phone: z.string().max(30).optional(),
	email: z.email().optional(),
	address: z.string().max(500).optional(),
	type: z.enum(customerTypes).default("CASH"),
	notes: z.string().max(1000).optional(),
});

export const updateCustomerSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	phone: z.string().max(30).optional(),
	email: z.email().optional(),
	address: z.string().max(500).optional(),
	type: z.enum(customerTypes).optional(),
	notes: z.string().max(1000).optional(),
});

export type CreateCustomerBody = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerBody = z.infer<typeof updateCustomerSchema>;
