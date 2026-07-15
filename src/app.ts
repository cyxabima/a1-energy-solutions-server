import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./middlewares/error.middleware.js";
import router from "./router/index.js";

const corsOptions = {
	origin: [
		"http://localhost:5173",
		"https://hms-frontend-gray-eight.vercel.app",
	],
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

app.use("/api/v1", router);

app.use(errorHandler);

export default app;
