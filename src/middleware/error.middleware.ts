import type { ErrorRequestHandler, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";

export const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
  }
  res.status(500).json({ message: "Internal Server Error" });
};
