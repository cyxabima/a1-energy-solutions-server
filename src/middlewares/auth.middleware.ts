import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthRequest, CustomJwtPayload } from "../types/index.js";
import ApiError from "../utils/api-error.js";

const SECRET = process.env.SECRET as string;

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

		const decodedToken = jwt.verify(token, SECRET) as CustomJwtPayload;
		console.log(token);
		console.log(decodedToken);

		if (!decodedToken?.data.userId) {
			return next(new ApiError(401, "UNAUTHORIZED", "Invalid token payload"));
		}

		const userId = decodedToken.data.userId;

		// TODO: make a db call to find the user

		const foundUser = {
			name: "Adeel",
			role: "ADMIN",
			userId: userId,
		};

		if (!foundUser) {
			return next(new ApiError(401, "UNAUTHORIZED", "User no longer exists"));
		}

		// TODO: Attached user to req
		req.user = foundUser;

		next();
	} catch (error) {
		console.log(error);
		return next(new ApiError(401, "UNAUTHORIZED", "invalid or expire token"));
	}
};

export default verifyJwt;
