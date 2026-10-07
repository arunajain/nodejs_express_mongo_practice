import type { HydratedDocument, UpdateQuery } from "mongoose";
import User from "../models/User.js";
import type { UserDocument } from "../types/user.type.js";

export type UserEntity = HydratedDocument<UserDocument>;

class UserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    return await User.findById(id);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return await User.findOne({ email: email.trim().toLowerCase() });
  }

  async findVerifiedByEmail(email: string): Promise<UserEntity | null> {
    return await User.findOne({
      email: email.trim().toLowerCase(),
      emailVerified: true,
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await User.exists({ email: email.trim().toLowerCase() });
    return user !== null;
  }

  async create(userData: Partial<UserDocument>): Promise<UserEntity> {
    const user = new User(userData);
    return await user.save();
  }

  async updateById(
    id: string,
    updateData: UpdateQuery<UserDocument>,
  ): Promise<UserEntity | null> {
    return await User.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    );
  }

  async deleteById(id: string): Promise<UserEntity | null> {
    return await User.findByIdAndDelete(id);
  }
}
export default UserRepository;
