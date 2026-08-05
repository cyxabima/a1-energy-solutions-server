import { type Router as ExpressRouter, Router } from "express";
import authRouter from "./auth.routes.js";
import brandRouter from "./brand.routes.js";
import categoryRouter from "./category.routes.js";
import customerRouter from "./customer.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import invoiceRouter from "./invoice.routes.js";
import paymentRouter from "./payment.routes.js";
import productRouter from "./product.routes.js";
import reportRouter from "./report.routes.js";
import stockRouter from "./stock.routes.js";
import unitRouter from "./unit.routes.js";
import userRouter from "./user.routes.js";

const router: ExpressRouter = Router();

router.use("/auth", authRouter);
router.use("/categories", categoryRouter);
router.use("/customers", customerRouter);
router.use("/invoices", invoiceRouter);
router.use("/payments", paymentRouter);
router.use("/dashboard", dashboardRouter);
router.use("/brands", brandRouter);
router.use("/units", unitRouter);
router.use("/products", productRouter);
router.use("/reports", reportRouter);
router.use("/users", userRouter);
router.use("/stocks", stockRouter);

export default router;
