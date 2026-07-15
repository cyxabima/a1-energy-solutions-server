import { type Router as ExpressRouter, Router } from "express";
import authRouter from "./auth.routes.js";
import brandRouter from "./brand.routes.js";
import categoryRouter from "./category.routes.js";
import unitRouter from "./unit.routes.js";

const router: ExpressRouter = Router();

router.use("/auth", authRouter);
router.use("/categories", categoryRouter);
router.use("/brands", brandRouter);
router.use("/units", unitRouter);

export default router;
