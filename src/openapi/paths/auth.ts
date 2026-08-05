import type { ZodOpenApiPathItemObject } from "zod-openapi";
import {
	changePasswordSchema,
	loginSchema,
	registerSchema,
	updateProfileSchema,
} from "../../validations/auth.validation.js";
import {
	authResponse,
	authUser,
	badRequest,
	conflict,
	forbidden,
	jsonBody,
	notFound,
	nothing,
	ok,
	safeUser,
	secured,
	unauthorized,
} from "../schemas.js";

export const paths: Record<string, ZodOpenApiPathItemObject> = {
	"/auth/register": {
		post: {
			operationId: "authRegister",
			tags: ["Auth"],
			summary: "Register a new account",
			description:
				"Public. Creates a user with role OWNER, sets the `accessToken` httpOnly cookie and returns the JWT.",
			requestBody: jsonBody(registerSchema, "User credentials"),
			responses: {
				"201": ok(authResponse, "Account created"),
				"409": conflict,
			},
		},
	},
	"/auth/login": {
		post: {
			operationId: "authLogin",
			tags: ["Auth"],
			summary: "Log in",
			description:
				"Public. Verifies credentials, sets the `accessToken` httpOnly cookie and returns the JWT.",
			requestBody: jsonBody(loginSchema, "Credentials"),
			responses: {
				"200": ok(authResponse, "Logged in"),
				"401": unauthorized,
			},
		},
	},
	"/auth/logout": {
		post: {
			operationId: "authLogout",
			tags: ["Auth"],
			summary: "Log out",
			description: "Clears the `accessToken` cookie.",
			security: secured,
			responses: {
				"200": ok(nothing, "Logged out"),
				"401": unauthorized,
			},
		},
	},
	"/auth/me": {
		get: {
			operationId: "authMe",
			tags: ["Auth"],
			summary: "Get current user",
			security: secured,
			responses: {
				"200": ok(authUser, "Authenticated user"),
				"401": unauthorized,
			},
		},
	},
	"/auth/password": {
		patch: {
			operationId: "authChangePassword",
			tags: ["Auth"],
			summary: "Change own password",
			security: secured,
			requestBody: jsonBody(changePasswordSchema, "Current and new password"),
			responses: {
				"200": ok(nothing, "Password updated"),
				"400": badRequest,
				"401": unauthorized,
				"404": notFound,
			},
		},
	},
	"/auth/profile": {
		patch: {
			operationId: "authUpdateProfile",
			tags: ["Auth"],
			summary: "Update own profile",
			description: "Empty string or null clears the avatar.",
			security: secured,
			requestBody: jsonBody(updateProfileSchema, "Profile fields"),
			responses: {
				"200": ok(safeUser, "Profile updated"),
				"400": badRequest,
				"401": unauthorized,
				"403": forbidden,
				"404": notFound,
			},
		},
	},
};
