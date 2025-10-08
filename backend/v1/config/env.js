import dotenv from "dotenv";
import { logger } from "../utils/_logger.js";

const env = process.env.NODE_ENV || "development";

const envFileMap = {
  development: ".env.development",
  test: ".env.test",
  production: ".env.production",
};

const envFile = envFileMap[env] || ".env.development";
dotenv.config({ path: envFile });

logger.info(`Loaded environment variables from ${envFile} for NODE_ENV=${env}`);

// Validate required variables
const requiredVars = [
  "MONGODB_URI",
  "REDIS_URL",
  "REDIS_HOST",
  "REDIS_PORT",
  "HOST",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_SERVICE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "JWT_SECRET",
  "PAYSTACK_SECRET_KEY",
  "DEFAULT_CURRENCY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "PORT",
];

const missingVars = requiredVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

export default env;