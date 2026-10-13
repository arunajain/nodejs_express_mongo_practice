/**
 * Unit tests for AuthService.
 *
 * What we MOCK (and why):
 *  - UserRepository            -> talks to MongoDB. Injected through the constructor,
 *                                 so we just pass a fake object (no module mocking needed).
 *  - PendingRegistrationService -> talks to Redis.
 *  - EmailService              -> sends real emails over SMTP.
 *  - TokenService              -> has its own responsibility (signing JWTs) and needs secrets.
 *                                 Here we only care that AuthService passes the right payload.
 *  - config                    -> would read the developer's .env file; tests must not
 *                                 depend on local machine settings.
 *
 * What we keep REAL (and why):
 *  - bcrypt      -> pure computation, no I/O. Using it for real proves the password is
 *                   actually hashed and that login really verifies it.
 *  - generateOTP -> pure function. We capture the generated value from the mocks instead.
 *  - AppError    -> plain class; we want to assert the real error type is thrown.
 *  - User model  -> only used to build in-memory documents (`new User(...)`), never saved.
 *
 * ESM note: this project is native ESM, so `jest.mock()` hoisting does not work.
 * We register mocks with `jest.unstable_mockModule()` and THEN dynamically import
 * the module under test, so it picks up the mocks.
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { AppError } from "../errors/AppError.js";
import type UserRepository from "../repositories/user.repository.js";
import type PendingRegistrationService from "../services/pendingRegistration.service.js";
import type EmailService from "../services/email.service.js";
import type TokenService from "./token.service.js";
import type { PendingRegistrationInput, RegisterInput } from "./auth.type.js";

// ---------------------------------------------------------------------------
// Module mocks (must be registered BEFORE importing auth.service)
// ---------------------------------------------------------------------------
const pendingRegistrationMock = {
  setPendingRegistration:
    jest.fn<(typeof PendingRegistrationService)["setPendingRegistration"]>(),
  setExpiryPendingRegistration:
    jest.fn<
      (typeof PendingRegistrationService)["setExpiryPendingRegistration"]
    >(),
  getPendingRegistrationData:
    jest.fn<
      (typeof PendingRegistrationService)["getPendingRegistrationData"]
    >(),
  deletePendingRegistration:
    jest.fn<(typeof PendingRegistrationService)["deletePendingRegistration"]>(),
  updatePendingRegistrationOtp:
    jest.fn<
      (typeof PendingRegistrationService)["updatePendingRegistrationOtp"]
    >(),
};

const emailServiceMock = {
  sendVerificationEmail:
    jest.fn<(typeof EmailService)["sendVerificationEmail"]>(),
};

const tokenServiceMock = {
  generateTokenPair: jest.fn<(typeof TokenService)["generateTokenPair"]>(),
};

const EXPIRES_IN_MINUTES = 15;

jest.unstable_mockModule("../services/pendingRegistration.service.js", () => ({
  default: pendingRegistrationMock,
}));
jest.unstable_mockModule("../services/email.service.js", () => ({
  default: emailServiceMock,
}));
jest.unstable_mockModule("./token.service.js", () => ({
  default: tokenServiceMock,
}));
jest.unstable_mockModule("../config/index.js", () => ({
  default: {
    email: { verificationEmailExpiresInMinutes: EXPIRES_IN_MINUTES },
  },
}));

const { AuthService } = await import("./auth.service.js"); //dynamic import

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function createUserRepositoryMock() {
  return {
    findById: jest.fn<UserRepository["findById"]>(),
    findByEmail: jest.fn<UserRepository["findByEmail"]>(),
    findVerifiedByEmail: jest.fn<UserRepository["findVerifiedByEmail"]>(),
    existsByEmail: jest.fn<UserRepository["existsByEmail"]>(),
    create: jest.fn<UserRepository["create"]>(),
    updateById: jest.fn<UserRepository["updateById"]>(),
    deleteById: jest.fn<UserRepository["deleteById"]>(),
  } satisfies UserRepository;
}

// Waits for fire-and-forget promises (like the email `.catch`) to settle.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const PASSWORD = "Secret@123";

const validRegisterInput: RegisterInput = {
  firstName: "john",
  lastName: "doe",
  email: "john.doe@example.com",
  phone: "9876543210",
  password: PASSWORD,
  confirmPassword: PASSWORD,
};

describe("AuthService", () => {
  let userRepository: ReturnType<typeof createUserRepositoryMock>;
  let authService: InstanceType<typeof AuthService>;

  beforeEach(() => {
    userRepository = createUserRepositoryMock();
    authService = new AuthService(userRepository);

    // Default "happy path" behaviour; individual tests override what they need.
    userRepository.findVerifiedByEmail.mockResolvedValue(null);
    pendingRegistrationMock.setPendingRegistration.mockResolvedValue();
    pendingRegistrationMock.setExpiryPendingRegistration.mockResolvedValue();
    pendingRegistrationMock.deletePendingRegistration.mockResolvedValue();
    pendingRegistrationMock.updatePendingRegistrationOtp.mockResolvedValue();
    emailServiceMock.sendVerificationEmail.mockResolvedValue(
      undefined as never,
    );
    tokenServiceMock.generateTokenPair.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  // -------------------------------------------------------------------------
  describe("register", () => {
    it("rejects when passwords do not match and has no side effects", async () => {
      const promise = authService.register({
        ...validRegisterInput,
        confirmPassword: "Different@123",
      });

      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toThrow("Passwords do not match");
      expect(userRepository.findVerifiedByEmail).not.toHaveBeenCalled();
      expect(
        pendingRegistrationMock.setPendingRegistration,
      ).not.toHaveBeenCalled();
      expect(emailServiceMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("rejects when a verified user with that email already exists", async () => {
      userRepository.findVerifiedByEmail.mockResolvedValue(
        new User({
          firstname: "John",
          email: validRegisterInput.email,
          password: "x",
        }),
      );

      const promise = authService.register(validRegisterInput);

      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toThrow("Email already exists");
      expect(userRepository.findVerifiedByEmail).toHaveBeenCalledWith(
        validRegisterInput.email,
      );
      expect(
        pendingRegistrationMock.setPendingRegistration,
      ).not.toHaveBeenCalled();
      expect(emailServiceMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("stores a pending registration with a hashed password and normalised fields", async () => {
      await authService.register({
        ...validRegisterInput,
        email: "  john.doe@example.com  ",
      });

      expect(
        pendingRegistrationMock.setPendingRegistration,
      ).toHaveBeenCalledTimes(1);
      const [, pendingUser] =
        pendingRegistrationMock.setPendingRegistration.mock.calls[0]!;

      expect(pendingUser).toEqual({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "9876543210",
        password: expect.any(String),
        otp: expect.stringMatching(/^\d{6}$/),
        role: "user",
      });
      // Never store the plain password, and the hash must verify against it.
      expect(pendingUser.password).not.toBe(PASSWORD);
      await expect(
        bcrypt.compare(PASSWORD, pendingUser.password),
      ).resolves.toBe(true);
    });

    it("stores phone as null and lastName as empty when they are not provided", async () => {
      const { lastName, phone, ...withoutOptional } = validRegisterInput;

      await authService.register(withoutOptional);

      const [, pendingUser] =
        pendingRegistrationMock.setPendingRegistration.mock.calls[0]!;
      expect(pendingUser.phone).toBeNull();
      expect(pendingUser.lastName).toBe("");
    });

    it("sets the pending registration to expire after the configured time", async () => {
      await authService.register(validRegisterInput);

      expect(
        pendingRegistrationMock.setExpiryPendingRegistration,
      ).toHaveBeenCalledWith(validRegisterInput.email, EXPIRES_IN_MINUTES * 60);
    });

    it("emails the same OTP that was stored", async () => {
      await authService.register(validRegisterInput);

      const [, pendingUser] =
        pendingRegistrationMock.setPendingRegistration.mock.calls[0]!;
      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        validRegisterInput.email,
        "John",
        pendingUser.otp,
        EXPIRES_IN_MINUTES,
      );
    });

    it("still succeeds when sending the email fails, and logs the error", async () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      emailServiceMock.sendVerificationEmail.mockRejectedValue(
        new Error("SMTP down"),
      );

      await expect(
        authService.register(validRegisterInput),
      ).resolves.toBeUndefined();
      await flushPromises();
      //flushPromises() gives pending asynchronous work an opportunity to complete before your test checks the result.
      // email operation is not synchronous. You’re starting asynchronous work without waiting for it to finish.
      expect(consoleError).toHaveBeenCalledWith(
        "Error sending verification email:",
        expect.any(Error),
      );
    });

    it("propagates Redis failures and does not send an email", async () => {
      pendingRegistrationMock.setPendingRegistration.mockRejectedValue(
        new Error("Redis connection lost"),
      );

      await expect(authService.register(validRegisterInput)).rejects.toThrow(
        "Redis connection lost",
      );
      expect(emailServiceMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    // KNOWN BUG: the Redis key uses the raw email, but the stored record uses the
    // lowercased email. Registering as "John.Doe@Example.com" and verifying as
    // "john.doe@example.com" will fail. `it.failing` passes while the bug exists;
    // once you fix it, Jest will tell you to change this to a normal `it`.
    it("stores the pending registration under the normalised email key", async () => {
      await authService.register({
        ...validRegisterInput,
        email: "John.Doe@Example.com",
      });

      expect(
        pendingRegistrationMock.setPendingRegistration,
      ).toHaveBeenCalledWith("john.doe@example.com", expect.anything());
    });
  });

  // -------------------------------------------------------------------------
  describe("verifyEmail", () => {
    const pendingRegistration: PendingRegistrationInput = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "9876543210",
      password: "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234",
      otp: "123456",
      role: "user",
    };

    beforeEach(() => {
      pendingRegistrationMock.getPendingRegistrationData.mockResolvedValue(
        pendingRegistration,
      );
      userRepository.create.mockResolvedValue(new User());
    });

    it("rejects when there is no pending registration", async () => {
      pendingRegistrationMock.getPendingRegistrationData.mockResolvedValue(
        null,
      );

      const promise = authService.verifyEmail({
        email: pendingRegistration.email,
        otp: "123456",
      });

      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toThrow(
        "No pending registration found for this email",
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid OTP and keeps the pending registration", async () => {
      const promise = authService.verifyEmail({
        email: pendingRegistration.email,
        otp: "000000",
      });

      await expect(promise).rejects.toThrow("Invalid OTP");
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(
        pendingRegistrationMock.deletePendingRegistration,
      ).not.toHaveBeenCalled();
    });

    it("creates a verified user from the pending registration and removes it", async () => {
      await authService.verifyEmail({
        email: pendingRegistration.email,
        otp: "123456",
      });

      expect(userRepository.create).toHaveBeenCalledWith({
        firstname: "John",
        lastname: "Doe",
        email: "john.doe@example.com",
        phone: "9876543210",
        password: pendingRegistration.password,
        role: "user",
        emailVerified: true,
      });
      expect(
        pendingRegistrationMock.deletePendingRegistration,
      ).toHaveBeenCalledWith(pendingRegistration.email);
    });

    it("saves lastname as null when the pending registration has none", async () => {
      const { lastName, ...withoutLastName } = pendingRegistration;
      pendingRegistrationMock.getPendingRegistrationData.mockResolvedValue(
        withoutLastName,
      );

      await authService.verifyEmail({
        email: pendingRegistration.email,
        otp: "123456",
      });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ lastname: null }),
      );
    });

    it("keeps the pending registration if saving the user fails, so the user can retry", async () => {
      userRepository.create.mockRejectedValue(new Error("Mongo unavailable"));

      await expect(
        authService.verifyEmail({
          email: pendingRegistration.email,
          otp: "123456",
        }),
      ).rejects.toThrow("Mongo unavailable");
      expect(
        pendingRegistrationMock.deletePendingRegistration,
      ).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("resendOtp", () => {
    const email = "john.doe@example.com";

    beforeEach(() => {
      pendingRegistrationMock.getPendingRegistrationData.mockResolvedValue({
        firstName: "John",
        email,
        phone: null,
        password: "hashed",
        otp: "111111",
        role: "user",
      });
    });

    it("rejects when there is no pending registration", async () => {
      pendingRegistrationMock.getPendingRegistrationData.mockResolvedValue(
        null,
      );

      const promise = authService.resendOtp({ email });

      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toThrow(/No pending registration found/);
      expect(
        pendingRegistrationMock.updatePendingRegistrationOtp,
      ).not.toHaveBeenCalled();
      expect(emailServiceMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("stores a new OTP, resets the expiry and emails the same OTP", async () => {
      await authService.resendOtp({ email });

      expect(
        pendingRegistrationMock.updatePendingRegistrationOtp,
      ).toHaveBeenCalledWith(
        email,
        expect.stringMatching(/^\d{6}$/),
        EXPIRES_IN_MINUTES * 60,
      );
      const [, newOtp] =
        pendingRegistrationMock.updatePendingRegistrationOtp.mock.calls[0]!;
      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        email,
        "John",
        newOtp,
        EXPIRES_IN_MINUTES,
      );
    });

    it('falls back to "User" when the pending registration has no first name', async () => {
      pendingRegistrationMock.getPendingRegistrationData.mockResolvedValue({
        firstName: "",
        email,
        phone: null,
        password: "hashed",
        otp: "111111",
        role: "user",
      });

      await authService.resendOtp({ email });

      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        email,
        "User",
        expect.any(String),
        EXPIRES_IN_MINUTES,
      );
    });

    it("still succeeds when sending the email fails", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      emailServiceMock.sendVerificationEmail.mockRejectedValue(
        new Error("SMTP down"),
      );

      await expect(authService.resendOtp({ email })).resolves.toBeUndefined();
      await flushPromises();
      expect(console.error).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("login", () => {
    let hashedPassword: string;

    beforeAll(async () => {
      // Low cost factor keeps the test fast; bcrypt.compare works with any cost.
      hashedPassword = await bcrypt.hash(PASSWORD, 4);
    });

    function buildUser(overrides: Record<string, unknown> = {}) {
      return new User({
        firstname: "John",
        lastname: "Doe",
        email: "john.doe@example.com",
        password: hashedPassword,
        role: "user",
        emailVerified: true,
        ...overrides,
      });
    }

    it("only looks up verified users", async () => {
      userRepository.findVerifiedByEmail.mockResolvedValue(buildUser());

      await authService.login({
        email: "john.doe@example.com",
        password: PASSWORD,
      });

      expect(userRepository.findVerifiedByEmail).toHaveBeenCalledWith(
        "john.doe@example.com",
      );
    });

    it("rejects with a generic message when the user does not exist", async () => {
      const promise = authService.login({
        email: "nobody@example.com",
        password: PASSWORD,
      });

      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toThrow("Invalid email or password");
      expect(tokenServiceMock.generateTokenPair).not.toHaveBeenCalled();
    });

    it("rejects with the same generic message when the password is wrong", async () => {
      // Same message as "user not found" so attackers can't tell which emails exist.
      userRepository.findVerifiedByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.login({
          email: "john.doe@example.com",
          password: "Wrong@1234",
        }),
      ).rejects.toThrow("Invalid email or password");
      expect(tokenServiceMock.generateTokenPair).not.toHaveBeenCalled();
    });

    it("returns tokens and the user for valid credentials", async () => {
      const user = buildUser();
      userRepository.findVerifiedByEmail.mockResolvedValue(user);

      const result = await authService.login({
        email: "john.doe@example.com",
        password: PASSWORD,
      });

      expect(tokenServiceMock.generateTokenPair).toHaveBeenCalledWith({
        userId: user._id.toString(),
        email: "john.doe@example.com",
        name: "John Doe",
        role: "user",
      });
      expect(result).toEqual({
        tokens: { accessToken: "access-token", refreshToken: "refresh-token" },
        user,
      });
    });

    // KNOWN BUG: with no last name the token name becomes "John null".
    it.failing(
      "uses only the first name in the token when lastname is missing",
      async () => {
        userRepository.findVerifiedByEmail.mockResolvedValue(
          buildUser({ lastname: null }),
        );

        await authService.login({
          email: "john.doe@example.com",
          password: PASSWORD,
        });

        expect(tokenServiceMock.generateTokenPair).toHaveBeenCalledWith(
          expect.objectContaining({ name: "John" }),
        );
      },
    );
  });
});
