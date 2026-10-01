import mongoose from "mongoose";
import config from "./index.js";

export const connectDB = async (): Promise<void> => {
  await mongoose.connect(config.databases.mongodb_uri);
  console.log("Mongodb Connected");
};
