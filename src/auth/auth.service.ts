import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/generateOTP.js";
import type {
  RegisterInput,
  VerifyEmailInput,
  TokenPair,
} from "./auth.type.js";
import UserRepository from "../repositories/user.repository.js";
import { AppError } from "../errors/AppError.js";
import EmailService from "../services/email.service.js";
import TokenService from "./token.service.js";
import config from "../config/index.js";
import type { PendingRegistration } from "../types/pendingRegistration.type.js";
import type { UserDocument } from "../types/user.type.js";
import pendingRegistrationService from "../services/pendingRegistration.service.js";
const SALT_ROUNDS = 12;

export class AuthService {
  readonly #userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.#userRepository = userRepository;
  }

  async register(inputData: RegisterInput): Promise<void> {
    if (inputData.password !== inputData.confirmPassword) {
      throw new AppError("Passwords do not match");
    }
    const existingUser = await this.#userRepository.findVerifiedByEmail(
      inputData.email,
    );
    if (existingUser) {
      throw new AppError("Email already exists");
    }

    const {
      firstName,
      lastName = "",
      email,
      phone = null,
      password,
    } = inputData;
    const _firstName =
      firstName.trim().slice(0, 1).toUpperCase() + firstName.slice(1);
    const hashedPassword = await bcrypt.hash(password.trim(), SALT_ROUNDS);
    const otp = generateOTP(6);
    const pendingUser: PendingRegistration = {
      firstName: _firstName,
      lastName: lastName.slice(0, 1).toUpperCase() + lastName.slice(1),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      password: hashedPassword,
      otp,
      role: "user",
    };

    await pendingRegistrationService.setPendingRegistration(email, pendingUser);

    await pendingRegistrationService.setExpiryPendingRegistration(
      email,
      config.email.verificationEmailExpiresInMinutes * 60,
    );

    EmailService.sendVerificationEmail(
      email,
      _firstName,
      otp,
      config.email.verificationEmailExpiresInMinutes,
    ).catch((error) => {
      console.error("Error sending verification email:", error);
    });
  }

  async verifyEmail(inputData: VerifyEmailInput): Promise<void> {
    const { email, otp } = inputData;
    const pendingUser =
      await pendingRegistrationService.getPendingRegistrationData(email);
    if (!pendingUser) {
      throw new AppError("No pending registration found for this email");
    }
    if (pendingUser.otp !== otp) {
      throw new AppError("Invalid OTP");
    }

    await this.#userRepository.create({
      firstname: pendingUser.firstName,
      lastname: pendingUser.lastName ?? null,
      email: pendingUser.email,
      phone: pendingUser.phone,
      password: pendingUser.password,
      role: pendingUser.role,
      emailVerified: true,
    });
    await pendingRegistrationService.deletePendingRegistration(email);
  }

  async resendOtp(inputData: { email: string }): Promise<void> {
    const { email } = inputData;
    const pendingRegistration =
      await pendingRegistrationService.getPendingRegistrationData(email);
    if (!pendingRegistration) {
      throw new AppError(
        "No pending registration found for this email. Try to register again.",
      );
    }
    const otp = generateOTP(6);

    await pendingRegistrationService.updatePendingRegistrationOtp(
      email,
      otp,
      config.email.verificationEmailExpiresInMinutes * 60,
    );

    EmailService.sendVerificationEmail(
      email,
      pendingRegistration.firstName || "User",
      otp,
      config.email.verificationEmailExpiresInMinutes,
    ).catch((error) => {
      console.error("Error sending verification email:", error);
    });
  }

  async login(inputData: {
    email: string;
    password: string;
  }): Promise<{ tokens: TokenPair; user: UserDocument }> {
    const { email, password } = inputData;
    const user = await this.#userRepository.findVerifiedByEmail(email);
    if (!user) {
      throw new AppError("Invalid email or password");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid email or password");
    }
    const tokens: TokenPair = TokenService.generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      name: user.firstname + " " + user.lastname,
      role: user.role,
    });
    return { tokens, user };
  }
}
const authService = new AuthService(new UserRepository());
export default authService;
