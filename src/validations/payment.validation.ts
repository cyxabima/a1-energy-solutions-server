import { z } from "zod";

export const paymentMethods = ["CASH", "CARD", "TRANSFER", "CHEQUE"] as const;

export const addPaymentSchema = z.object({
	amount: z.number().min(0.01).max(100000000),
	method: z.enum(paymentMethods),
	reference: z.string().max(200).optional(),
});

export type AddPaymentBody = z.infer<typeof addPaymentSchema>;
