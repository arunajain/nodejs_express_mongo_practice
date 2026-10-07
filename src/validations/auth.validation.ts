import { z } from "zod";
export const registerSchema = z.object({
  firstName: z
    .string("First name is required")
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(30, "Name must not exceed 30 characters")
    .regex(/^[A-Za-z]+$/, "First name must contain only letters"),
  lastName: z
    .string("Last name is required")
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(30, "Name must not exceed 30 characters")
    .regex(/^[A-Za-z]+$/, "last name must contain only letters")
    .optional(),
  email: z
    .string("Email is required")
    .trim()
    .pipe(z.email("Please enter a valid email address")),
  phone: z.string().optional(),
  password: z
    .string("Password is required")
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(30, "Password must not exceed 30 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
  confirmPassword: z
    .string("Confirm password is required")
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(30, "Password must not exceed 30 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

export const verifyEmailSchema = z.object({
  email: z
    .string("Email is required")
    .trim()
    .pipe(z.email("Please enter a valid email address")),
  otp: z
    .string("OTP is required")
    .trim()
    .regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
});

export const pendingRegistrationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z]+$/),
  lastName: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z]+$/)
    .optional(),
  email: z.email(),
  phone: z.string().nullable(),
  password: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/),
  otp: z.string().regex(/^\d{6}$/),
  role: z.enum(["user", "admin"]),
});

export const resendOtpSchema = z.object({
  email: z
    .string("Email is required")
    .trim()
    .pipe(z.email("Please enter a valid email address")),
});

export const loginSchema = z.object({
  email: z
    .string("Email is required")
    .trim()
    .pipe(z.email("Please enter a valid email address")),
  password: z
    .string("Password is required")
    .trim()
    .min(8)
    .max(30)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type PendingRegistrationInput = z.infer<
  typeof pendingRegistrationSchema
>;
export type LoginInput = z.infer<typeof loginSchema>;
