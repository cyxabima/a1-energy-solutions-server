import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./middlewares/error.middleware.js";

const app: Express = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
	res.status(200).json({
		status: 200,
		success: true,
		message: "Server is healthy",
	});
});

// Routes will be mounted here
// app.use("/api/v1", router);

app.use(errorHandler);

export default app;
