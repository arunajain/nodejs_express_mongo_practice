import type { ErrorRequestHandler, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { ZodError } from "zod";
export const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Validation Error",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }
  res.status(500).json({ message: "Internal Server Error" });
};
