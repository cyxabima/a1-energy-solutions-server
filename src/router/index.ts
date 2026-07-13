import { type Router as ExpressRouter, Router } from "express";
import authRouter from "./auth.routes.js";

const router: ExpressRouter = Router();

router.use("/auth", authRouter);

export default router;
