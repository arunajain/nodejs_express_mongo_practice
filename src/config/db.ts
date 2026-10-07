import mongoose from "mongoose";
import config from "./index.js";

export const connectDB = async (): Promise<void> => {
  await mongoose.connect(config.databases.mongodb_uri);
  console.log("Mongodb Connected");
  console.log("Database:", mongoose.connection.name);
  console.log("Host:", mongoose.connection.host);
};
