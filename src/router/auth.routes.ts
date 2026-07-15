import { type Router as ExpressRouter, Router } from "express";
import { login, logout, me, register } from "../controllers/auth.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";

const router: ExpressRouter = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", verifyJwt, logout);
router.get("/me", verifyJwt, me);

export default router;
