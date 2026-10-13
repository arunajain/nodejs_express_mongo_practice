import type { AccessTokenPayload } from "../auth/auth.type.js";

declare global {
  namespace Express {
    interface Request {
      // Set by the `authenticate` middleware
      user?: AccessTokenPayload;
    }
  }
}

export {};
