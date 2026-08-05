import { createDocument, type oas31 } from "zod-openapi";
import { paths as authPaths } from "./paths/auth.js";
import { paths as brandPaths } from "./paths/brand.js";
import { paths as categoryPaths } from "./paths/category.js";
import { paths as customerPaths } from "./paths/customer.js";
import { paths as dashboardPaths } from "./paths/dashboard.js";
import { paths as invoicePaths } from "./paths/invoice.js";
import { paths as paymentPaths } from "./paths/payment.js";
import { paths as productPaths } from "./paths/product.js";
import { paths as reportPaths } from "./paths/report.js";
import { paths as settingsPaths } from "./paths/settings.js";
import { paths as stockPaths } from "./paths/stock.js";
import { paths as unitPaths } from "./paths/unit.js";
import { paths as userPaths } from "./paths/user.js";
import { errorEnvelope } from "./schemas.js";

export const openApiDocument: oas31.OpenAPIObject = createDocument({
	openapi: "3.1.0",
	info: {
		title: "A1 Energy Solutions API",
		version: "1.0.0",
		description:
			"Backend API for A1 Energy Solutions: attribute-driven inventory (categories, brands, units, products), FIFO batch stock with an immutable movement audit, sales (customers, invoices, payments), reports, dashboard KPIs and business-settings letterheads.\n\nAll responses use the envelope `{ success, statusCode, data, message }`; errors use `{ success: false, statusCode, errorType, message }`.",
	},
	servers: [{ url: "/api/v1" }],
	tags: [
		{ name: "Auth" },
		{ name: "Users" },
		{ name: "Categories" },
		{ name: "Brands" },
		{ name: "Units" },
		{ name: "Products" },
		{ name: "Stocks" },
		{ name: "Customers" },
		{ name: "Invoices" },
		{ name: "Payments" },
		{ name: "Reports" },
		{ name: "Dashboard" },
		{ name: "Settings" },
	],
	paths: {
		...authPaths,
		...userPaths,
		...categoryPaths,
		...brandPaths,
		...unitPaths,
		...productPaths,
		...stockPaths,
		...customerPaths,
		...invoicePaths,
		...paymentPaths,
		...reportPaths,
		...dashboardPaths,
		...settingsPaths,
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description:
					"JWT returned by login/register. The API accepts it from the `accessToken` httpOnly cookie OR the `Authorization: Bearer <token>` header. Use the header here (Swagger 'Authorize') so 'Try it out' works.",
			},
		},
		schemas: {
			ErrorEnvelope: errorEnvelope,
		},
	},
}) as oas31.OpenAPIObject;
