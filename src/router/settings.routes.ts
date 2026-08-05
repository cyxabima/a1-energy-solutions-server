import { type Router as ExpressRouter, Router } from "express";
import {
	getBusinessSettingsHandler,
	updateBusinessSettingsHandler,
} from "../controllers/settings.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateBusinessSettingsSchema } from "../validations/settings.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/business", getBusinessSettingsHandler);
router.put(
	"/business",
	authorizeRoles(["ADMIN"]),
	validate(updateBusinessSettingsSchema),
	updateBusinessSettingsHandler,
);

export default router;
