import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import {
	createUser,
	findUserByEmail,
	type SafeUser,
	toSafeUser,
} from "../models/user.model.js";
import type { AuthRequest, AuthUser } from "../types/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type {
	LoginInput,
	RegisterInput,
} from "../validations/auth.validation.js";

function generateToken(user: SafeUser): string {
	return jwt.sign(
		{ data: { userId: user._id.toString(), role: user.role } },
		config.secret,
		{ expiresIn: "7d" },
	);
}

function setTokenCookie(res: Response, token: string): void {
	res.cookie("accessToken", token, {
		httpOnly: true,
		secure: config.nodeEnv === "production",
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});
}

export async function register(req: Request, res: Response) {
	const { name, email, password } = req.body as RegisterInput;

	const existing = await findUserByEmail(email);
	if (existing) {
		throw new ApiError(409, "CONFLICT", "Email already registered");
	}

	const hashedPassword = await bcrypt.hash(password, 10);

	const user = await createUser({
		name,
		email: email.toLowerCase(),
		password: hashedPassword,
		role: "OWNER",
	});

	const token = generateToken(user);
	setTokenCookie(res, token);

	return res
		.status(201)
		.json(
			new ApiResponse<{ user: SafeUser; token: string }>(
				201,
				{ user, token },
				"Registered successfully",
			),
		);
}

export async function login(req: Request, res: Response) {
	const { email, password } = req.body as LoginInput;

	const user = await findUserByEmail(email);
	if (!user) {
		throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
	}

	const isPasswordValid = await bcrypt.compare(password, user.password);
	if (!isPasswordValid) {
		throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
	}

	const safeUser = toSafeUser(user);
	const token = generateToken(safeUser);
	setTokenCookie(res, token);

	return res
		.status(200)
		.json(
			new ApiResponse<{ user: SafeUser; token: string }>(
				200,
				{ user: safeUser, token },
				"Logged in successfully",
			),
		);
}

export async function logout(_req: Request, res: Response) {
	res.clearCookie("accessToken");
	return res
		.status(200)
		.json(new ApiResponse<null>(200, null, "Logged out successfully"));
}

export async function me(req: Request, res: Response) {
	const authReq = req as AuthRequest;
	const user = authReq.user;

	if (!user) {
		throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
	}

	return res
		.status(200)
		.json(new ApiResponse<AuthUser>(200, user, "User fetched successfully"));
}
