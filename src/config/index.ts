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
  email: {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER!,
    password: process.env.SMTP_PASSWORD!,
    from: {
      name: process.env.FROM_NAME!,
      address: process.env.FROM_ADDRESS!,
    },
    verificationEmailSubject: process.env.VERIFICATION_EMAIL_SUBJECT!,
    verificationEmailExpiresInMinutes:
      Number(process.env.VERIFICATION_EMAIL_EXPIRES_IN_MINUTES!) || 15,
  },
  redis: {
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT),
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
};
export default config;
