import "./env.js";
const config = {
  serviceName: process.env.SERVICE_NAME || "TASK_MANAGER",
  app: {
    env: process.env.NODE_ENV!,
    port: Number(process.env.PORT) || 3001,
  },
  databases: {
    mongodb_username: process.env.MONGODB_USERNAME!,
    mongodb_password: process.env.MONGODB_PASSWORD!,
    mongodb_uri: process.env.MONGODB_URI!,
  },
};
export default config;
