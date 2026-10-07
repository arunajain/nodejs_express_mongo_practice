import app from "./app.js";
import config from "./config/index.js";
import { connectDB } from "./config/db.js";
import redisClient from "./config/redis.js";

const PORT = config.app.port;

async function startServer(): Promise<void> {
  await connectDB();
  await redisClient.connect();
  app.listen(PORT, () => {
    console.log("Server is listening on port : " + PORT);
  });
}

startServer();
