import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types/index.js";
import ApiError from "../utils/api-error.js";

export const authorizeRoles = (allowedRoles: string[]) => {
	return (req: AuthRequest, _: Response, next: NextFunction) => {
		if (!req.user) {
			return next(new ApiError(401, "UNAUTHORIZED", "Authentication required"));
		}

		if (!allowedRoles.includes(req.user.role)) {
			return next(
				new ApiError(
					403,
					"FORBIDDEN",
					`Access denied. Role '${req.user.role}' is not authorized for this resource.`,
				),
			);
		}

		next();
	};
};
