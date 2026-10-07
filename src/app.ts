import express from "express";
import cors from "cors";
import indexRouter from "./routes/index.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Nodejs Express Mongo app is working" });
});

app.use("/api", indexRouter);
app.use(errorMiddleware);
export default app;
