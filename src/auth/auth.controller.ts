import type { Request, Response, NextFunction } from "express";
import { durationToMS } from "../utils/durationToMS.js";
import config from "../config/index.js";
import {
  registerSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginSchema,
} from "../validations/auth.validation.js";
import authService from "./auth.service.js";
class AuthController {
  static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const inputData = registerSchema.parse(req.body);
      await authService.register(inputData);
      res.status(201).json({ message: "Verification code sent to email." });
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const inputData = verifyEmailSchema.parse(req.body);
      await authService.verifyEmail(inputData);
      res.status(200).json({ message: "Email verified successfully." });
    } catch (error) {
      next(error);
    }
  }

  static async resendOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const inputData = resendOtpSchema.parse(req.body);
      await authService.resendOtp(inputData);
      res.status(200).json({ message: "Verification code resent to email." });
    } catch (error) {
      next(error);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const inputData = loginSchema.parse(req.body);
      const { tokens, user } = await authService.login(inputData);
      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: durationToMS(config.jwt.refreshExpiresIn),
      });
      res.setHeader("Authorization", `Bearer ${tokens.accessToken}`);
      res.status(200).json({
        message: "Login successful",
        user: {
          firstName: user.firstname,
          lastName: user.lastname,
          email: user.email,
          phone: user.phone,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
export default AuthController;
