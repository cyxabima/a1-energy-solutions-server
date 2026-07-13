import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { findUserById, toSafeUser } from "../models/user.model.js";
import type { AuthRequest, CustomJwtPayload } from "../types/index.js";
import ApiError from "../utils/api-error.js";

const verifyJwt = async (req: AuthRequest, _: Response, next: NextFunction) => {
	try {
		const authHeader = req.header("Authorization");
		const token =
			req.cookies?.accessToken || authHeader?.replace("Bearer ", "");

		if (!token) {
			return next(
				new ApiError(401, "UNAUTHORIZED", "Unauthorized: No token provided"),
			);
		}

		const decodedToken = jwt.verify(token, config.secret) as CustomJwtPayload;

		if (!decodedToken?.data.userId) {
			return next(new ApiError(401, "UNAUTHORIZED", "Invalid token payload"));
		}

		const foundUser = await findUserById(decodedToken.data.userId);

		if (!foundUser) {
			return next(new ApiError(401, "UNAUTHORIZED", "User no longer exists"));
		}

		req.user = toSafeUser(foundUser);
		next();
	} catch (_error) {
		return next(new ApiError(401, "UNAUTHORIZED", "Invalid or expired token"));
	}
};

export default verifyJwt;
