import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { findCustomerById } from "../models/customer.model.js";
import {
	adjustPaid,
	createInvoice,
	deleteInvoice,
	findInvoiceById,
	getInvoiceDetail,
	getInvoices,
	type Invoice,
	type InvoiceItem,
	type InvoiceStatus,
	markCancelled,
	markConfirmed,
	round2,
	updateInvoice,
} from "../models/invoice.model.js";
import { createPayment, type Payment } from "../models/payment.model.js";
import { findProductsByIds } from "../models/product.model.js";
import {
	type CreateStockMovementInput,
	createMovements,
	deleteMovement,
	getCurrentStock,
} from "../models/stock.model.js";
import {
	consumeBatchesFIFO,
	restoreBatch,
} from "../models/stock-batch.model.js";
import type { AuthRequest } from "../types/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	CreateInvoiceBody,
	InvoiceItemBody,
	UpdateInvoiceBody,
} from "../validations/invoice.validation.js";
import type { AddPaymentBody } from "../validations/payment.validation.js";

type IdParam = { id: string };
type InvoiceIdParam = { invoiceId: string };

function validateId(id: string | undefined, label: string): string {
	if (!id) {
		throw new ApiError(400, "BAD_REQUEST", `Missing ${label}`);
	}
	if (!ObjectId.isValid(id)) {
		throw new ApiError(400, "BAD_REQUEST", `Invalid ${label} format`);
	}
	return id;
}

async function buildInvoiceItems(
	rawItems: InvoiceItemBody[],
): Promise<{ items: InvoiceItem[]; subtotal: number }> {
	const productIds = rawItems.map((item) => new ObjectId(item.product));
	const products = await findProductsByIds(productIds);

	if (products.length !== productIds.length) {
		throw new ApiError(
			404,
			"PRODUCT_NOT_FOUND",
			"One or more products were not found",
		);
	}

	const items: InvoiceItem[] = rawItems.map((raw) => {
		const discount = round2(raw.discount ?? 0);
		return {
			product: new ObjectId(raw.product),
			quantity: raw.quantity,
			unitPrice: raw.unitPrice,
			discount,
			total: round2(raw.quantity * raw.unitPrice - discount),
		};
	});

	const subtotal = round2(items.reduce((sum, item) => sum + item.total, 0));
	return { items, subtotal };
}

export async function createInvoiceHandler(req: Request, res: Response) {
	const authReq = req as AuthRequest;
	const body = req.body as CreateInvoiceBody;

	if (body.customer) {
		const customer = await findCustomerById(body.customer);
		if (!customer) {
			throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
		}
	}

	const { items, subtotal } = await buildInvoiceItems(body.items);
	const discount = round2(body.discount);
	const taxRate = body.taxRate;
	const tax = round2(((subtotal - discount) * taxRate) / 100);
	const total = round2(subtotal - discount + tax);

	const input: {
		customer?: ObjectId;
		items: InvoiceItem[];
		subtotal: number;
		discount: number;
		taxRate: number;
		tax: number;
		total: number;
		paidAmount: number;
		balance: number;
		status: InvoiceStatus;
		reference?: string;
		createdBy: ObjectId;
	} = {
		items,
		subtotal,
		discount,
		taxRate,
		tax,
		total,
		paidAmount: 0,
		balance: total,
		status: "DRAFT",
		createdBy: new ObjectId(authReq.user?._id ?? ""),
	};
	if (body.customer) input.customer = new ObjectId(body.customer);
	if (body.reference !== undefined) input.reference = body.reference;

	const invoice = await createInvoice(input);

	return res
		.status(201)
		.json(
			new ApiResponse<Invoice>(201, invoice, "Invoice created successfully"),
		);
}

export async function getInvoicesHandler(req: Request, res: Response) {
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

	const params: {
		page: number;
		limit: number;
		search?: string;
		status?: string;
		customer?: string;
	} = { page, limit };
	if (typeof req.query.search === "string" && req.query.search.trim()) {
		params.search = req.query.search.trim();
	}
	if (typeof req.query.status === "string" && req.query.status.trim()) {
		params.status = req.query.status.trim();
	}
	if (typeof req.query.customer === "string" && req.query.customer.trim()) {
		params.customer = req.query.customer.trim();
	}

	const { invoices, total } = await getInvoices(params);

	return res.status(200).json(
		new ApiResponse<{
			invoices: typeof invoices;
			pagination: {
				page: number;
				limit: number;
				total: number;
				totalPages: number;
			};
		}>(
			200,
			{
				invoices,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
			"Invoices fetched successfully",
		),
	);
}

export async function getInvoiceHandler(req: Request<IdParam>, res: Response) {
	const id = validateId(req.params.id, "invoice ID");

	const detail = await getInvoiceDetail(id);
	if (!detail) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<typeof detail>(
				200,
				detail,
				"Invoice fetched successfully",
			),
		);
}

export async function updateInvoiceHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "invoice ID");
	const body = req.body as UpdateInvoiceBody;

	const existing = await findInvoiceById(id);
	if (!existing) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}
	if (existing.status !== "DRAFT") {
		throw new ApiError(
			400,
			"INVOICE_NOT_DRAFT",
			"Only draft invoices can be updated",
		);
	}

	if (body.customer) {
		const customer = await findCustomerById(body.customer);
		if (!customer) {
			throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
		}
	}

	let nextItems = existing.items;
	let subtotal = existing.subtotal;
	if (body.items) {
		const built = await buildInvoiceItems(body.items);
		nextItems = built.items;
		subtotal = built.subtotal;
	}

	const discount = round2(body.discount ?? existing.discount);
	const taxRate = body.taxRate ?? existing.taxRate;
	const tax = round2(((subtotal - discount) * taxRate) / 100);
	const total = round2(subtotal - discount + tax);

	const update: {
		customer?: ObjectId;
		items?: InvoiceItem[];
		subtotal?: number;
		discount?: number;
		taxRate?: number;
		tax?: number;
		total?: number;
		reference?: string;
	} = {
		subtotal,
		discount,
		taxRate,
		tax,
		total,
	};
	if (body.items) update.items = nextItems;
	if (body.customer) update.customer = new ObjectId(body.customer);
	if (body.reference !== undefined) update.reference = body.reference;

	const invoice = await updateInvoice(id, update);
	if (!invoice) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<Invoice>(200, invoice, "Invoice updated successfully"),
		);
}

export async function confirmInvoiceHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const authReq = req as AuthRequest;
	const id = validateId(req.params.id, "invoice ID");

	const invoice = await findInvoiceById(id);
	if (!invoice) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}
	if (invoice.status !== "DRAFT") {
		throw new ApiError(
			400,
			"INVOICE_NOT_DRAFT",
			"Only draft invoices can be confirmed",
		);
	}

	for (const item of invoice.items) {
		const available = await getCurrentStock(item.product.toString());
		if (available < item.quantity) {
			throw new ApiError(
				400,
				"INSUFFICIENT_STOCK",
				`Insufficient stock for product ${item.product.toString()}. Available: ${available}, requested: ${item.quantity}`,
			);
		}
	}

	const userId = new ObjectId(authReq.user?._id ?? "");
	const consumedBatches: { batchId: ObjectId; quantity: number }[] = [];
	const createdMovements: ObjectId[] = [];

	try {
		const confirmedItems: InvoiceItem[] = [];
		const movementsInput: CreateStockMovementInput[] = [];

		for (const item of invoice.items) {
			const consumptions = await consumeBatchesFIFO(
				item.product.toString(),
				item.quantity,
			);
			for (const consumption of consumptions) {
				consumedBatches.push({
					batchId: consumption.batchId,
					quantity: consumption.quantity,
				});
			}

			const cogs = round2(
				consumptions.reduce((sum, c) => sum + c.quantity * c.buyingPrice, 0),
			);

			confirmedItems.push({
				product: item.product,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				total: item.total,
				batchConsumptions: consumptions,
				costOfGoodsSold: cogs,
			});

			movementsInput.push({
				product: item.product,
				quantity: item.quantity,
				type: "OUT",
				salePrice: item.unitPrice,
				reason: `Sale - ${invoice.invoiceNumber}`,
				reference: invoice.invoiceNumber,
				batchConsumptions: consumptions,
				createdBy: userId,
			});
		}

		const movements = await createMovements(movementsInput);
		for (const movement of movements) {
			createdMovements.push(movement._id);
		}

		const finalItems: InvoiceItem[] = confirmedItems.map((item, index) => {
			const result: InvoiceItem = { ...item };
			const movementId = movements[index]?._id;
			if (movementId) result.stockMovementId = movementId;
			return result;
		});

		await markConfirmed(id, finalItems);
	} catch (error) {
		for (const consumption of consumedBatches) {
			await restoreBatch(consumption.batchId, consumption.quantity).catch(
				() => undefined,
			);
		}
		for (const movementId of createdMovements) {
			await deleteMovement(movementId.toString()).catch(() => undefined);
		}
		throw error;
	}

	const detail = await getInvoiceDetail(id);
	return res
		.status(200)
		.json(
			new ApiResponse<typeof detail>(
				200,
				detail,
				"Invoice confirmed successfully",
			),
		);
}

export async function cancelInvoiceHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const authReq = req as AuthRequest;
	const id = validateId(req.params.id, "invoice ID");

	const invoice = await findInvoiceById(id);
	if (!invoice) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}
	if (invoice.status === "CANCELLED") {
		throw new ApiError(400, "BAD_REQUEST", "Invoice is already cancelled");
	}

	const userId = new ObjectId(authReq.user?._id ?? "");

	if (invoice.status === "CONFIRMED") {
		if (invoice.paidAmount > 0) {
			throw new ApiError(
				400,
				"INVOICE_HAS_PAYMENTS",
				"Cannot cancel: invoice has payments",
			);
		}

		for (const item of invoice.items) {
			if (item.stockMovementId) {
				await deleteMovement(item.stockMovementId.toString()).catch(
					() => undefined,
				);
			}
			if (item.batchConsumptions) {
				for (const consumption of item.batchConsumptions) {
					await restoreBatch(consumption.batchId, consumption.quantity).catch(
						() => undefined,
					);
				}
			}
		}
	}

	const cancelled = await markCancelled(id, userId);
	if (!cancelled) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}

	return res
		.status(200)
		.json(
			new ApiResponse<Invoice>(
				200,
				cancelled,
				"Invoice cancelled successfully",
			),
		);
}

export async function deleteInvoiceHandler(
	req: Request<IdParam>,
	res: Response,
) {
	const id = validateId(req.params.id, "invoice ID");

	const invoice = await findInvoiceById(id);
	if (!invoice) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}
	if (invoice.status !== "DRAFT") {
		throw new ApiError(
			400,
			"INVOICE_NOT_DRAFT",
			"Only draft invoices can be deleted",
		);
	}

	await deleteInvoice(id);

	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Invoice deleted successfully"));
}

export async function addPaymentHandler(
	req: Request<InvoiceIdParam>,
	res: Response,
) {
	const authReq = req as AuthRequest;
	const invoiceId = validateId(req.params.invoiceId, "invoice ID");
	const body = req.body as AddPaymentBody;

	const invoice = await findInvoiceById(invoiceId);
	if (!invoice) {
		throw new ApiError(404, "NOT_FOUND", "Invoice not found");
	}
	if (invoice.status !== "CONFIRMED") {
		throw new ApiError(
			400,
			"INVOICE_NOT_CONFIRMED",
			"Only confirmed invoices can receive payments",
		);
	}

	const amount = round2(body.amount);
	if (amount > invoice.balance) {
		throw new ApiError(
			400,
			"INVALID_PAYMENT_AMOUNT",
			`Payment exceeds remaining balance. Balance: ${invoice.balance}, amount: ${amount}`,
		);
	}

	const input: {
		invoice: ObjectId;
		amount: number;
		method: Payment["method"];
		reference?: string;
		createdBy: ObjectId;
	} = {
		invoice: new ObjectId(invoiceId),
		amount,
		method: body.method,
		createdBy: new ObjectId(authReq.user?._id ?? ""),
	};
	if (body.reference !== undefined) input.reference = body.reference;

	const payment = await createPayment(input);
	await adjustPaid(invoiceId, amount);

	return res
		.status(201)
		.json(new ApiResponse<Payment>(201, payment, "Payment added successfully"));
}
