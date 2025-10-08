import mongoose from "mongoose";
import { logger } from "./_logger.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  } catch (error) {
    logger.error(`MongoDB disconnection error: ${error.message}`);
    throw error;
  }
};

export { connectDB, disconnectDB };