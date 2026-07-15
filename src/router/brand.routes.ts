import { type Router as ExpressRouter, Router } from "express";
import {
	createBrandHandler,
	deleteBrandHandler,
	getBrandHandler,
	getBrandsHandler,
	updateBrandHandler,
} from "../controllers/brand.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createBrandSchema,
	updateBrandSchema,
} from "../validations/brand.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getBrandsHandler);
router.get("/:id", getBrandHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN"]),
	validate(createBrandSchema),
	createBrandHandler,
);
router.put(
	"/:id",
	authorizeRoles(["ADMIN"]),
	validate(updateBrandSchema),
	updateBrandHandler,
);
router.delete("/:id", authorizeRoles(["ADMIN"]), deleteBrandHandler);

export default router;
