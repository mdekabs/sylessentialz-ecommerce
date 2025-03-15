import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { Client } from "@elastic/elasticsearch";
import asyncHandler from "express-async-handler";

import {
  authRoute,
  userRoute,
  productRoute,
  cartRoute,
  orderRoute,
  shippingRoute,
  reviewRoute
} from "./routes/index.js";

import {
  appLogger,
  errorLogger,
  logger,
  checkCache,
  cacheResponse,
  pagination
} from "./middlewares/index.js";

import { swaggerOptions } from "./swaggerConfig.js";

dotenv.config();
const app = express();

// Initialize Elasticsearch client
const esClient = new Client({ node: process.env.ELASTICSEARCH_URI || "http://localhost:9200" });

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(appLogger);

// Swagger setup
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// API routes
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", pagination, userRoute);
app.use("/api/v1/products", checkCache, cacheResponse(300), productRoute, pagination);
app.use("/api/v1/carts", checkCache, cacheResponse(300), cartRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/shipping", checkCache, cacheResponse(300), shippingRoute);
app.use("/api/v1/review", pagination, reviewRoute);

// Database connection
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.info("✅ Successfully connected to MongoDB");

    // Verify Elasticsearch connection
    const esHealth = await esClient.cluster.health();
    logger.info(`✅ Elasticsearch connected: ${esHealth.status}`);
  } catch (err) {
    logger.error("❌ Database or Elasticsearch connection failed:", err);
    process.exit(1);
  }
}

connectToDatabase();

// Apply error logging middleware (logs errors to errors.log)
app.use(errorLogger);

// Global error handler (improved async error handling)
app.use(
  asyncHandler(async (err, req, res, next) => {
    logger.error(`❌ Internal Server Error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ message: "Internal Server Error" });
  })
);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Server is running on port ${PORT}`);
});
