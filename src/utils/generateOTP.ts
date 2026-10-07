import crypto from "node:crypto";
export function generateOTP(length: number = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return crypto.randomInt(min, max).toString().padStart(length, "0");
}
