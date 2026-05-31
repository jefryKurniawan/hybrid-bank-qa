/**
 * Express middleware — error handling, validation
 */
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { PaymentError, ValidationError, BankError } from "../utils/errors.js";

/**
 * API Key authentication middleware (v2.0 spec)
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== "test-key-mock") {
    throw new BankError("Invalid or missing API key", "UNAUTHORIZED", 401);
  }
  next();
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err.message);

  // Zod validation error
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    res.status(422).json({
      error: "Validation failed",
      issues,
    });
    return;
  }

  // Custom validation error
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      issues: err.issues,
    });
    return;
  }

  // Domain errors (Bank, CEX, Blockchain, Settlement)
  if (err instanceof PaymentError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Unknown error
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
}
