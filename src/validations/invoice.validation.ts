import { z } from "zod";
import { config } from "../config/index.js";

const objectIdSchema = z
	.string()
	.regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");

const moneySchema = z.number().min(0).max(100000000);

const invoiceItemSchema = z
	.object({
		product: objectIdSchema,
		quantity: z.number().int().positive(),
		unitPrice: moneySchema,
		discount: moneySchema.optional(),
	})
	.superRefine((item, ctx) => {
		const discount = item.discount ?? 0;
		const maxDiscount = item.quantity * item.unitPrice;
		if (discount > maxDiscount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Line discount exceeds line total (max ${maxDiscount})`,
				path: ["discount"],
			});
		}
	});

export const createInvoiceSchema = z.object({
	customer: objectIdSchema.optional(),
	items: z.array(invoiceItemSchema).min(1),
	discount: moneySchema.default(0),
	taxRate: z.number().min(0).max(100).default(config.vatRate),
	reference: z.string().max(200).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceBody = z.infer<typeof updateInvoiceSchema>;
export type InvoiceItemBody = z.infer<typeof invoiceItemSchema>;
