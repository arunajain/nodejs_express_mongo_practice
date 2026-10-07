import type {
  RegisterInput,
  VerifyEmailInput,
  PendingRegistrationInput,
  LoginInput,
} from "../validations/auth.validation.js";

export interface AccessTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}
export interface RefreshTokenPayload {
  userId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type {
  RegisterInput,
  VerifyEmailInput,
  PendingRegistrationInput,
  LoginInput,
};
