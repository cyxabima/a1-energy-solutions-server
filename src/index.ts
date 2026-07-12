import express, { type Request, type Response } from "express";

const app = express();

app.get("/health", (_: Request, res: Response) => {
	res.status(200).json({
		staus: 200,
		sucess: true,
		message: "server is healthy",
	});
});

app.listen(8000, () => {
	console.log("App is listening on Port", 8000);
});
