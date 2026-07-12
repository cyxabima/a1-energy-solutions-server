import type { NextFunction, Request, Response } from "express";
import ApiError from "../utils/api-error.js";

export async function errorHandler(
	err: ApiError | Error,
	_: Request,
	res: Response,
	_next: NextFunction,
) {
	if (err instanceof ApiError) {
		return res.status(err.statusCode).json(err);
	}
	console.log(err.message);
	return res
		.status(500)
		.json(new ApiError(500, "Internal Server Error", "something went wrong"));
}
