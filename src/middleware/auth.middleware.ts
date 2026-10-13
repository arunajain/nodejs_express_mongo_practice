import type { Request, Response, NextFunction } from "express";
import TokenService from "../auth/token.service.js";
import { UnauthorizedError } from "../errors/AppError.js";
import type { AccessTokenPayload } from "../auth/auth.type.js";

// Verifies "Authorization: Bearer <accessToken>" and puts the payload on req.user.
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Access token is missing"));
    return;
  }
  try {
    req.user = TokenService.verifyAccessToken(header.slice(7).trim());
    next();
  } catch (error) {
    next(error);
  }
}

// For handlers behind `authenticate`: returns the logged-in user or throws 401.
export function getAuthUser(req: Request): AccessTokenPayload {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}
