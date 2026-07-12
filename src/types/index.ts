import type { Request } from "express";
import type jwt from "jsonwebtoken";

export interface CustomJwtPayload extends jwt.JwtPayload {
	data: {
		userId: string;
		role: string;
	};
}

export interface AuthRequest extends Request {
	user?: {
		name: string;
		role: string;
	};
}
