import { type Router as ExpressRouter, Router } from "express";
import {
	createCategoryHandler,
	deleteCategoryHandler,
	getAncestorsHandler,
	getCategoriesHandler,
	getCategoryAttributesHandler,
	getCategoryHandler,
	getTreeHandler,
	updateCategoryHandler,
} from "../controllers/category.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createCategorySchema,
	updateCategorySchema,
} from "../validations/category.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/tree", getTreeHandler);
router.get("/", getCategoriesHandler);
router.get("/:id", getCategoryHandler);
router.get("/:id/attributes", getCategoryAttributesHandler);
router.get("/:id/ancestors", getAncestorsHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN"]),
	validate(createCategorySchema),
	createCategoryHandler,
);
router.put(
	"/:id",
	authorizeRoles(["ADMIN"]),
	validate(updateCategorySchema),
	updateCategoryHandler,
);
router.delete("/:id", authorizeRoles(["ADMIN"]), deleteCategoryHandler);

export default router;
