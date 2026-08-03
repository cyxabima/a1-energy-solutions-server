import { type Router as ExpressRouter, Router } from "express";
import {
	createUserHandler,
	getUsersHandler,
	updateUserHandler,
} from "../controllers/user.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createUserSchema,
	updateUserSchema,
} from "../validations/user.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", authorizeRoles(["ADMIN"]), getUsersHandler);
router.post(
	"/",
	authorizeRoles(["ADMIN"]),
	validate(createUserSchema),
	createUserHandler,
);
router.patch(
	"/:id",
	authorizeRoles(["ADMIN"]),
	validate(updateUserSchema),
	updateUserHandler,
);

export default router;
