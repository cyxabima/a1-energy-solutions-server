import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { adjustPaid, findInvoiceById } from "../models/invoice.model.js";
import {
	deletePayment,
	findPaymentById,
	getPayments,
	type PaymentSummary,
} from "../models/payment.model.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

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

export async function getPaymentsHandler(req: Request, res: Response) {
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const params: {
		page: number;
		limit: number;
		invoice?: string;
		method?: string;
	} = { page, limit };
	if (typeof req.query.invoice === "string" && req.query.invoice.trim()) {
		params.invoice = req.query.invoice.trim();
	}
	if (typeof req.query.method === "string" && req.query.method.trim()) {
		params.method = req.query.method.trim();
	}

	const { payments, total } = await getPayments(params);

	return res.status(200).json(
		new ApiResponse<{
			payments: PaymentSummary[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				payments,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Payments fetched successfully",
		),
	);
}

export async function deletePaymentHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "payment ID");

	const payment = await findPaymentById(id);
	if (!payment) {
		throw new ApiError(404, "NOT_FOUND", "Payment not found");
	}

	const invoice = await findInvoiceById(payment.invoice.toString());
	if (!invoice) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}

	await deletePayment(id);
	await adjustPaid(payment.invoice.toString(), -payment.amount);

	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Payment deleted successfully"));
}
