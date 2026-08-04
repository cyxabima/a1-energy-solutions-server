import { type Router as ExpressRouter, Router } from "express";
import {
	addPaymentHandler,
	cancelInvoiceHandler,
	confirmInvoiceHandler,
	createInvoiceHandler,
	deleteInvoiceHandler,
	getInvoiceHandler,
	getInvoicesHandler,
	updateInvoiceHandler,
} from "../controllers/invoice.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createInvoiceSchema,
	updateInvoiceSchema,
} from "../validations/invoice.validation.js";
import { addPaymentSchema } from "../validations/payment.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getInvoicesHandler);
router.get("/:id", getInvoiceHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	validate(createInvoiceSchema),
	createInvoiceHandler,
);
router.patch(
	"/:id",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	validate(updateInvoiceSchema),
	updateInvoiceHandler,
);
router.post(
	"/:id/confirm",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	confirmInvoiceHandler,
);
router.post(
	"/:id/cancel",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	cancelInvoiceHandler,
);
router.delete("/:id", authorizeRoles(["ADMIN"]), deleteInvoiceHandler);

router.post(
	"/:invoiceId/payments",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	validate(addPaymentSchema),
	addPaymentHandler,
);

export default router;
