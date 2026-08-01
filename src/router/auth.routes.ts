import { type Router as ExpressRouter, Router } from "express";
import {
	changePasswordHandler,
	login,
	logout,
	me,
	register,
	updateProfileHandler,
} from "../controllers/auth.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	changePasswordSchema,
	loginSchema,
	registerSchema,
	updateProfileSchema,
} from "../validations/auth.validation.js";

const router: ExpressRouter = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", verifyJwt, logout);
router.get("/me", verifyJwt, me);
router.patch(
	"/password",
	verifyJwt,
	validate(changePasswordSchema),
	changePasswordHandler,
);
router.patch(
	"/profile",
	verifyJwt,
	validate(updateProfileSchema),
	updateProfileHandler,
);

export default router;
