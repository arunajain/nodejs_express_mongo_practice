import redisClient from "../config/redis.js";
import RedisService from "./redis.service.js";
import { pendingRegistrationSchema } from "../validations/auth.validation.js";
import type { PendingRegistration } from "../types/pendingRegistration.type.js";
import type { PendingRegistrationInput } from "../auth/auth.type.js";

const PENDING_REGISTRATION_PREFIX = "pending_registration:";
class PendingRegistrationService {
  static async setPendingRegistration(
    email: string,
    pendingRegistrationData: PendingRegistration,
  ): Promise<void> {
    const key = `${PENDING_REGISTRATION_PREFIX}${email}`;
    const redisData: Record<string, string> = {
      firstName: pendingRegistrationData.firstName,
      lastName: pendingRegistrationData.lastName,
      email: pendingRegistrationData.email,
      phone: pendingRegistrationData.phone ?? "",
      password: pendingRegistrationData.password,
      otp: pendingRegistrationData.otp,
      role: pendingRegistrationData.role,
    };
    await RedisService.hashSet(key, redisData);
  }

  static async setExpiryPendingRegistration(
    email: string,
    expirationInSeconds: number,
  ): Promise<void> {
    const key = `${PENDING_REGISTRATION_PREFIX}${email}`;
    await RedisService.expire(key, expirationInSeconds);
  }

  static async getPendingRegistrationData(
    email: string,
  ): Promise<PendingRegistrationInput | null> {
    const key = `${PENDING_REGISTRATION_PREFIX}${email}`;
    const value = await RedisService.hashGetAll(key);
    if (!value || Object.keys(value).length === 0) {
      return null;
    }

    const pendingRegistrationDataFromRedis = pendingRegistrationSchema.parse({
      firstName: value.firstName,
      lastName: value.lastName,
      email: value.email,
      phone: value.phone === "" ? null : value.phone,
      password: value.password,
      otp: value.otp,
      role: value.role,
    });
    return pendingRegistrationDataFromRedis;
  }

  static async deletePendingRegistration(email: string): Promise<void> {
    const key = `${PENDING_REGISTRATION_PREFIX}${email}`;
    await RedisService.del(key);
  }

  static async isPendingRegistrationExists(email: string): Promise<boolean> {
    const key = `${PENDING_REGISTRATION_PREFIX}${email}`;
    return await RedisService.exists(key);
  }
  static async updatePendingRegistrationOtp(
    email: string,
    newOtp: string,
    expirationInSeconds: number = 900,
  ): Promise<void> {
    const key = `${PENDING_REGISTRATION_PREFIX}${email}`;
    await RedisService.hashSetField(key, "otp", newOtp);
    await RedisService.expire(key, expirationInSeconds);
  }
}
export default PendingRegistrationService;
