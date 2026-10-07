import redisClient from "../config/redis.js";
import type { PendingRegistration } from "../types/pendingRegistration.type.js";
class RedisService {
  static async set(
    key: string,
    value: string,
    expirationInSeconds?: number,
  ): Promise<void> {
    if (expirationInSeconds) {
      await redisClient.set(key, value, { EX: expirationInSeconds });
    } else {
      await redisClient.set(key, value);
    }
  }

  static async get(key: string): Promise<string | null> {
    return await redisClient.get(key);
  }

  static async del(key: string): Promise<void> {
    await redisClient.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const exists = await redisClient.exists(key);
    return exists === 1;
  }

  static async hashSet(
    hashKey: string,
    data: Record<string, string>,
  ): Promise<void> {
    await redisClient.hSet(hashKey, data);
  }

  static async hashSetField(
    hashKey: string,
    field: string,
    value: string,
  ): Promise<void> {
    await redisClient.hSet(hashKey, field, value);
  }
  static async hashGet(hashKey: string, field: string): Promise<string | null> {
    return await redisClient.hGet(hashKey, field);
  }
  static async hashDel(hashKey: string, field: string): Promise<void> {
    await redisClient.hDel(hashKey, field);
  }
  static async hashExists(hashKey: string, field: string): Promise<boolean> {
    const exists = await redisClient.hExists(hashKey, field);
    return exists === 1;
  }
  static async hashGetAll(hashKey: string): Promise<Record<string, string>> {
    return await redisClient.hGetAll(hashKey);
  }

  static async expire(key: string, expirationInSeconds: number): Promise<void> {
    await redisClient.expire(key, expirationInSeconds);
  }
}

export default RedisService;
