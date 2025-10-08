import dotenv from "dotenv";
import { emailQueue } from "../jobs/queues/_emailQueue.js";
import emailWorker from "../jobs/workers/_emailProcessor.js";
import { logger } from "../config/_logger.js";

dotenv.config();

// Start email queue worker
emailQueue.process(emailWorker);
logger.info("Email worker is running and processing jobs...");