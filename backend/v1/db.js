// db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "./middlewares/index.js";
import { AuthController } from "./controllers/index.js";

dotenv.config();


async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.DB_URI, { serverSelectionTimeoutMS: 5000 });
        logger.info("✅Database is ready for atomicity.");

        // Ensure the admin user exists
        await AuthController.create_admin_user();
    } catch (mongoErr) {
        logger.error("❌ MongoDB connection failed:", mongoErr);
        process.exit(1);
    }
}

export { connectToDatabase };
