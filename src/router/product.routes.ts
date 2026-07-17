import { type Router as ExpressRouter, Router } from "express";
import {
	createProductHandler,
	deleteProductHandler,
	getProductHandler,
	getProductsHandler,
	updateProductHandler,
} from "../controllers/product.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createProductSchema,
	updateProductSchema,
} from "../validations/product.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getProductsHandler);
router.get("/:id", getProductHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN", "OWNER"]),
	validate(createProductSchema),
	createProductHandler,
);
router.put(
	"/:id",
	authorizeRoles(["ADMIN", "OWNER"]),
	validate(updateProductSchema),
	updateProductHandler,
);
router.delete("/:id", authorizeRoles(["ADMIN", "OWNER"]), deleteProductHandler);

export default router;
