import { type Router as ExpressRouter, Router } from "express";
import {
	createStockHandler,
	deleteStockHandler,
	getProductStockHistoryHandler,
	getStockMovementsHandler,
	getStockSummaryHandler,
} from "../controllers/stock.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createStockSchema } from "../validations/stock.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getStockMovementsHandler);
router.get("/summary", getStockSummaryHandler);
router.get("/product/:productId", getProductStockHistoryHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	validate(createStockSchema),
	createStockHandler,
);

router.delete("/:id", authorizeRoles(["ADMIN"]), deleteStockHandler);

export default router;
