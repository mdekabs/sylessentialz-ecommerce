import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "./_logger.js";

// Load environment variables
dotenv.config();

// MongoDB connection URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/your_database_name";

// MongoDB connection options
const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

/**
 * Establishes a connection to the MongoDB database.
 * @returns {Promise<void>} Resolves when the connection is successful, rejects on error.
 * @throws {Error} If the connection fails.
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, connectionOptions);
    logger.info("Connected to MongoDB successfully");
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Closes the MongoDB connection.
 * @returns {Promise<void>} Resolves when the connection is closed.
 * @throws {Error} If closing the connection fails.
 */
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (error) {
    logger.error(`Failed to close MongoDB connection: ${error.message}`);
    throw new Error(`Failed to close database connection: ${error.message}`);
  }
}

export { connectDB, disconnectDB };