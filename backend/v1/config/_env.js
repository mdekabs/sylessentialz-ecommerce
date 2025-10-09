import dotenv from 'dotenv';
import { logger } from './_logger.js';

// Determine environment
export const env = process.env.NODE_ENV || 'development';

// Map environment to respective .env file
const envFileMap = {
  development: '.env.development',
  test: '.env.test',
  production: '.env.production',
};

const envFile = envFileMap[env] || '.env.development';

// Load environment variables from the appropriate file
dotenv.config({ path: envFile });
logger.info(`Loaded environment variables from ${envFile} for NODE_ENV=${env}`);

// Export environment
export default env;