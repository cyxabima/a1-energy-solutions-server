import { type Router as ExpressRouter, Router } from "express";
import {
	getSalesReportHandler,
	getTopCustomersHandler,
	getTopProductsHandler,
} from "../controllers/report.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/sales", getSalesReportHandler);
router.get("/products", getTopProductsHandler);
router.get("/customers", getTopCustomersHandler);

export default router;
