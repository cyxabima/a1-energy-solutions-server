import { type Router as ExpressRouter, Router } from "express";
import {
	createUnitHandler,
	deleteUnitHandler,
	getUnitHandler,
	getUnitsHandler,
	updateUnitHandler,
} from "../controllers/unit.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
	createUnitSchema,
	updateUnitSchema,
} from "../validations/unit.validation.js";

const router: ExpressRouter = Router();

router.use(verifyJwt);

router.get("/", getUnitsHandler);
router.get("/:id", getUnitHandler);

router.post(
	"/",
	authorizeRoles(["ADMIN"]),
	validate(createUnitSchema),
	createUnitHandler,
);
router.put(
	"/:id",
	authorizeRoles(["ADMIN"]),
	validate(updateUnitSchema),
	updateUnitHandler,
);
router.delete("/:id", authorizeRoles(["ADMIN"]), deleteUnitHandler);

export default router;
