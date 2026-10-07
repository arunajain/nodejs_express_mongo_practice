import express from "express";
import AuthController from "./auth.controller.js";
const router = express.Router();
router.post("/register", AuthController.register);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/resend-otp", AuthController.resendOtp);
router.post("/login", AuthController.login);

export default router;
