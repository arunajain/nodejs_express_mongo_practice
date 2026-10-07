import jwt from "jsonwebtoken";
import type { AccessTokenPayload } from "./auth.type.js";
import { AppError, UnauthorizedError } from "../errors/AppError.js";

class JwtService {
  static sign<T extends object>(
    payload: T,
    secret: string,
    expiresIn: string,
  ): string {
    if (!secret) throw new AppError("JWT secret not configured", 500);
    return jwt.sign(payload, secret, {
      expiresIn: expiresIn as NonNullable<jwt.SignOptions["expiresIn"]>,
    });
  }

  static verify<T extends object>(token: string, secret: string): T {
    if (!secret) throw new AppError("JWT secret not configured", 500);
    try {
      return jwt.verify(token, secret) as T;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError)
        throw new UnauthorizedError("Token has expired");
      if (error instanceof jwt.JsonWebTokenError)
        throw new UnauthorizedError("Invalid Token");
      throw error;
    }
  }
}
export default JwtService;
