import { type Router as ExpressRouter, Router } from "express";
import {
	deletePaymentHandler,
	getPaymentsHandler,
} from "../controllers/payment.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getPaymentsHandler);
router.delete("/:id", authorizeRoles(["ADMIN"]), deletePaymentHandler);

export default router;
