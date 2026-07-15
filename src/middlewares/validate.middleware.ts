import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import ApiError from "../utils/api-error.js";

export function validate(schema: ZodType) {
	return (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			const message = result.error.issues
				.map((issue) => {
					const path = issue.path.join(".");
					return path ? `${path}: ${issue.message}` : issue.message;
				})
				.join("; ");
			return next(new ApiError(400, "VALIDATION_ERROR", message));
		}
		req.body = result.data;
		next();
	};
}
