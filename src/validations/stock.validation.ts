import { z } from "zod";

export const createStockSchema = z
	.object({
		product: z.string(),
		quantity: z.number().refine((q) => q !== 0, "Quantity cannot be zero"),
		type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]),
		buyingPrice: z.number().positive().optional(),
		salePrice: z.number().positive().optional(),
		reason: z.string().min(1).max(500),
		reference: z.string().max(100).optional(),
		toOwner: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.type === "IN" && data.buyingPrice === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "buyingPrice is required for IN",
			});
		}
		if (data.type === "OUT" && data.salePrice === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "salePrice is required for OUT",
			});
		}
		if (
			data.type === "ADJUSTMENT" &&
			data.quantity > 0 &&
			data.buyingPrice === undefined
		) {
			ctx.addIssue({
				code: "custom",
				message: "buyingPrice is required for positive ADJUSTMENT",
			});
		}
		if (data.type === "TRANSFER" && !data.toOwner) {
			ctx.addIssue({
				code: "custom",
				message: "toOwner is required for TRANSFER",
			});
		}
		if (data.type === "TRANSFER" && (data.buyingPrice || data.salePrice)) {
			ctx.addIssue({
				code: "custom",
				message: "TRANSFER cannot have prices",
			});
		}
	});

export type CreateStockBody = z.infer<typeof createStockSchema>;
