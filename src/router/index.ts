import { type Router as ExpressRouter, Router } from "express";
import authRouter from "./auth.routes.js";
import categoryRouter from "./category.routes.js";

const router: ExpressRouter = Router();

router.use("/auth", authRouter);
router.use("/categories", categoryRouter);

export default router;
