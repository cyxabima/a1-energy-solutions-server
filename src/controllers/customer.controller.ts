import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
	type Customer,
	type CustomerStats,
	countInvoicesByCustomer,
	createCustomer,
	deleteCustomer,
	findCustomerById,
	getCustomerStats,
	getCustomers,
	type UpdateCustomerInput,
	updateCustomer,
} from "../models/customer.model.js";
import type { AuthRequest } from "../types/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	CreateCustomerBody,
	UpdateCustomerBody,
} from "../validations/customer.validation.js";

type IdParam = { id: string };

function validateId(id: string | undefined, label: string): string {
	if (!id) {
		throw new ApiError(400, "BAD_REQUEST", `Missing ${label}`);
	}
	if (!ObjectId.isValid(id)) {
		throw new ApiError(400, "BAD_REQUEST", `Invalid ${label} format`);
	}
	return id;
}

export async function createCustomerHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;
	const body = req.body as CreateCustomerBody;

	const input: {
		name: string;
		type: Customer["type"];
		createdBy: ObjectId;
		phone?: string;
		email?: string;
		address?: string;
		notes?: string;
	} = {
		name: body.name,
		type: body.type,
		createdBy: new ObjectId(authReq.user?._id ?? ""),
	};
	if (body.phone !== undefined) input.phone = body.phone;
	if (body.email !== undefined) input.email = body.email;
	if (body.address !== undefined) input.address = body.address;
	if (body.notes !== undefined) input.notes = body.notes;

	const customer = await createCustomer(input);

	return res
		.status(201)
		.json(
			new ApiResponse<Customer>(201, customer, "Customer created successfully"),
		);
}

export async function getCustomersHandler(req: Request, res: Response) {
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const params: {
		page: number;
		limit: number;
		search?: string;
		type?: string;
	} = { page, limit };
	if (typeof req.query.search === "string" && req.query.search.trim()) {
		params.search = req.query.search.trim();
	}
	if (typeof req.query.type === "string" && req.query.type.trim()) {
		params.type = req.query.type.trim();
	}

	const { customers, total } = await getCustomers(params);

	return res.status(200).json(
		new ApiResponse<{
			customers: Customer[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				customers,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Customers fetched successfully",
		),
	);
}

export async function getCustomerHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "customer ID");

	const [customer, stats] = await Promise.all([
		findCustomerById(id),
		getCustomerStats(id),
	]);
	if (!customer) {
		throw new ApiError(404, "NOT_FOUND", "Customer not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<{ customer: Customer; stats: CustomerStats }>(
				200,
				{ customer, stats },
				"Customer fetched successfully",
			),
		);
}

export async function updateCustomerHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "customer ID");
	const body = req.body as UpdateCustomerBody;

	const existing = await findCustomerById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Customer not found");
	}

	const update: UpdateCustomerInput = {};
	if (body.name !== undefined) update.name = body.name;
	if (body.phone !== undefined) update.phone = body.phone;
	if (body.email !== undefined) update.email = body.email;
	if (body.address !== undefined) update.address = body.address;
	if (body.type !== undefined) update.type = body.type;
	if (body.notes !== undefined) update.notes = body.notes;

	const customer = await updateCustomer(id, update);
	if (!customer) {
		throw new ApiError(404, "NOT_FOUND", "Customer not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<Customer>(200, customer, "Customer updated successfully"),
		);
}

export async function deleteCustomerHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "customer ID");

	const existing = await findCustomerById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Customer not found");
	}

	const invoiceCount = await countInvoicesByCustomer(id);
	if (invoiceCount > 0) {
		throw new ApiError(
			409,
			"CUSTOMER_HAS_INVOICES",
			"Cannot delete: customer has invoices",
		);
	}

	await deleteCustomer(id);

	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Customer deleted successfully"));
}
