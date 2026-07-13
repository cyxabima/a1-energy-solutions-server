import { type Router as ExpressRouter, Router } from "express";
import { login, logout, me, register } from "../controllers/auth.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";

const router: ExpressRouter = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", verifyJwt, logout);
router.get("/me", verifyJwt, me);

export default router;
