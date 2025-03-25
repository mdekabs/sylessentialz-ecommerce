// db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "./middlewares/index.js";
import { AuthController } from "./controllers/index.js";

dotenv.config();

if (!process.env.DB_URI) {
    console.error("❌ DB_URI is not defined in environment variables");
    process.exit(1);
}

async function connectToDatabase() {
    try {
        logger.info(`🔄 Connecting to MongoDB at: ${process.env.DB_URI}`);
        await mongoose.connect(process.env.DB_URI, { serverSelectionTimeoutMS: 5000 });
        logger.info("✅ Successfully connected to MongoDB");

        // Ensure the admin user exists
        await AuthController.create_admin_user();
    } catch (mongoErr) {
        logger.error("❌ MongoDB connection failed:", mongoErr);
        process.exit(1);
    }
}

export { connectToDatabase };
