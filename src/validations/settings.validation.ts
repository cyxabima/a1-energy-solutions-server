import { z } from "zod";

const urlOrDataUri = z.string().refine((value) => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return value.startsWith("data:image/");
	}
}, "logoUrl must be an http(s) URL or a data:image URI");

export const updateBusinessSettingsSchema = z.object({
	businessName: z.string().trim().min(1).max(200),
	address: z.string().trim().max(500).optional(),
	phone: z.string().trim().max(50).optional(),
	email: z.string().trim().email().max(200).optional(),
	vatNumber: z.string().trim().max(100).optional(),
	footerNote: z.string().trim().max(1000).optional(),
	logoUrl: urlOrDataUri.optional(),
});

export type UpdateBusinessSettingsBody = z.infer<
	typeof updateBusinessSettingsSchema
>;
