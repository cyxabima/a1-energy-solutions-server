import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
	getBusinessSettings,
	type UpdateBusinessSettingsInput,
	upsertBusinessSettings,
} from "../models/settings.model.js";
import type { AuthRequest } from "../types/index.js";
import ApiResponse from "../utils/api-response.js";
import type { UpdateBusinessSettingsBody } from "../validations/settings.validation.js";

export async function getBusinessSettingsHandler(_req: Request, res: Response) {
	const settings = await getBusinessSettings();
	return res
		.status(200)
		.json(
			new ApiResponse<typeof settings>(
				200,
				settings,
				"Business settings fetched successfully",
			),
		);
}

export async function updateBusinessSettingsHandler(
	req: Request,
	res: Response,
) {
	const authReq = req as AuthRequest;
	const body = req.body as UpdateBusinessSettingsBody;
	const userId = new ObjectId(authReq.user?._id ?? "");

	const input: UpdateBusinessSettingsInput = {
		businessName: body.businessName,
	};
	if (body.address !== undefined) input.address = body.address;
	if (body.phone !== undefined) input.phone = body.phone;
	if (body.email !== undefined) input.email = body.email;
	if (body.vatNumber !== undefined) input.vatNumber = body.vatNumber;
	if (body.footerNote !== undefined) input.footerNote = body.footerNote;
	if (body.logoUrl !== undefined) input.logoUrl = body.logoUrl;

	const settings = await upsertBusinessSettings(input, userId);
	return res
		.status(200)
		.json(
			new ApiResponse<typeof settings>(
				200,
				settings,
				"Business settings updated successfully",
			),
		);
}
