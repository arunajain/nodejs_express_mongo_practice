import app from "./app.js";
import config from "./config/index.js";
import { connectDB } from "./config/db.js";

const PORT = config.app.port;

async function startServer(): Promise<void> {
  await connectDB();
  app.listen(PORT, () => {
    console.log("Server is listening on port : " + PORT);
  });
}

startServer();
