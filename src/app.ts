import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { openApiDocument } from "./openapi/index.js";
import router from "./router/index.js";

const corsOptions = {
	origin: config.corsOrigins,
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
};

const app: Express = express();

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_, res) => {
	res.status(200).json({
		status: 200,
		success: true,
		message: "Server is healthy",
	});
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get("/api-docs.json", (_req, res) => {
	res.json(openApiDocument);
});

app.use("/api/v1", router);

app.use(errorHandler);

export default app;
