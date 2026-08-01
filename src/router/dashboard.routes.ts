import { type Router as ExpressRouter, Router } from "express";
import { getDashboardStatsHandler } from "../controllers/dashboard.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/stats", getDashboardStatsHandler);

export default router;
