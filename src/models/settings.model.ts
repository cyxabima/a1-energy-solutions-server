import { type Collection, ObjectId, type OptionalId } from "mongodb";
import { getDb } from "../db/index.js";

export interface BusinessSettings {
	_id: string;
	businessName: string;
	address: string;
	phone: string;
	email?: string;
	vatNumber?: string;
	footerNote?: string;
	logoUrl?: string;
	updatedBy: ObjectId;
	updatedAt: Date;
}

export type UpdateBusinessSettingsInput = Partial<
	Pick<
		BusinessSettings,
		| "businessName"
		| "address"
		| "phone"
		| "email"
		| "vatNumber"
		| "footerNote"
		| "logoUrl"
	>
>;

const SETTINGS_ID = "business";

function collection(): Collection<OptionalId<BusinessSettings>> {
	return getDb().collection<OptionalId<BusinessSettings>>("business_settings");
}

function defaultSettings(): BusinessSettings {
	return {
		_id: SETTINGS_ID,
		businessName: "",
		address: "",
		phone: "",
		updatedBy: new ObjectId(),
		updatedAt: new Date(),
	};
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
	const doc = await collection().findOne({ _id: SETTINGS_ID });
	if (!doc) return defaultSettings();
	return { ...defaultSettings(), ...doc } as BusinessSettings;
}

export async function upsertBusinessSettings(
	data: UpdateBusinessSettingsInput,
	updatedBy: ObjectId,
): Promise<BusinessSettings> {
	const update: Record<string, unknown> = {
		updatedBy,
		updatedAt: new Date(),
	};
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined) update[key] = value;
	}

	await collection().updateOne(
		{ _id: SETTINGS_ID },
		{ $set: update, $setOnInsert: { _id: SETTINGS_ID } },
		{ upsert: true },
	);

	return getBusinessSettings();
}
