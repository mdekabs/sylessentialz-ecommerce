import mongoose from "mongoose";
import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
import { logger } from "./middlewares/index.js";
import { AuthController } from "./controllers/index.js";

dotenv.config();

if (!process.env.DB_URI) {
  console.error("❌ DB_URI is not defined in environment variables");
  process.exit(1);
}

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URI || "http://localhost:9200",
  maxRetries: 5,
  requestTimeout: 60000,
});

async function configureElasticsearch() {
  try {
    await esClient.indices.putSettings({
      index: {
        number_of_replicas: 0,
      },
    });
    logger.info("✅ Elasticsearch settings updated: replicas set to 0");
  } catch (err) {
    logger.error("⚠️ Failed to update Elasticsearch settings:", err.message);
  }
}

async function connectToDatabase() {
  try {
    logger.info(`🔄 Connecting to MongoDB at: ${process.env.DB_URI}`);
    await mongoose.connect(process.env.DB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info("✅ Successfully connected to MongoDB");

    // Ensure the admin user exists
    await AuthController.create_admin_user();
  } catch (mongoErr) {
    logger.error("❌ MongoDB connection failed:", mongoErr);
    process.exit(1);
  }

  try {
    const esHealth = await esClient.cluster.health({ timeout: "10s" });
    logger.info(`✅ Elasticsearch connected: Status is ${esHealth.status}`);
    if (esHealth.status === "yellow" && process.env.NODE_ENV !== "production") {
      await configureElasticsearch();
    }
  } catch (esErr) {
    logger.error(
      "⚠️ Elasticsearch connection issue (non-critical):",
      esErr.message
    );
  }
}

export { connectToDatabase, esClient };
