import { type Router as ExpressRouter, Router } from "express";
import {
	createCustomerHandler,
	deleteCustomerHandler,
	getCustomerHandler,
	getCustomersHandler,
	updateCustomerHandler,
} from "../controllers/customer.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createCustomerSchema,
	updateCustomerSchema,
} from "../validations/customer.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getCustomersHandler);
router.get("/:id", getCustomerHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	validate(createCustomerSchema),
	createCustomerHandler,
);
router.patch(
	"/:id",
	authorizeRoles(["ADMIN", "OWNER", "STAFF"]),
	validate(updateCustomerSchema),
	updateCustomerHandler,
);
router.delete("/:id", authorizeRoles(["ADMIN"]), deleteCustomerHandler);

export default router;
