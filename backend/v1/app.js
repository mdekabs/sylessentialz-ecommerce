import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { Client } from "@elastic/elasticsearch";
import asyncHandler from "express-async-handler";
import { AuthController } from "./controllers/index.js";
import {
  authRoute,
  userRoute,
  productRoute,
  cartRoute,
  orderRoute,
  shippingRoute,
  reviewRoute,
} from "./routes/index.js";
import { responseHandler } from "./utils/index.js";
import {
  appLogger,
  errorLogger,
  logger,
  checkCache,
  cacheResponse,
  pagination,
} from "./middlewares/index.js";
import { swaggerOptions } from "./swaggerConfig.js";

dotenv.config();

if (!process.env.DB_URI) {
  console.error("❌ DB_URI is not defined in environment variables");
  process.exit(1);
}

const app = express();
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URI || "http://localhost:9200",
  maxRetries: 5,
  requestTimeout: 60000,
});

// Test Elasticsearch client initialization
esClient
  .ping()
  .then(() => logger.info("✅ Elasticsearch client initialized successfully"))
  .catch((err) =>
    logger.error("⚠️ Failed to initialize Elasticsearch client:", err)
  );

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));
app.use(appLogger);

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", pagination, userRoute);
app.use("/api/v1/products", pagination, productRoute);
app.use("/api/v1/carts", cartRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/shipping", checkCache, cacheResponse(300), shippingRoute);
app.use("/api/v1/review", pagination, reviewRoute);

app.get(
  "/api/v1/health",
  asyncHandler(async (req, res) => {
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const esStatus = await esClient
      .ping()
      .then(() => "connected")
      .catch(() => "disconnected");
    res.status(200).json({
      status: "ok",
      database: dbStatus,
      elasticsearch: esStatus,
    });
  })
);

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

connectToDatabase();

app.use(errorLogger);

app.use((err, req, res, next) => {
  const error = err || new Error("Unknown error occurred");

  logger.error(`❌ Internal Server Error: ${error.message}`, {
    stack: error.stack || "No stack trace available",
    method: req.method,
    path: req.path,
    body: req.body,
  });

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";
  responseHandler(res, statusCode, "error", message);
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(
    `🚀 Server is running on port ${PORT} in ${
      process.env.NODE_ENV || "development"
    } mode`
  );
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  await mongoose.connection.close();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

export { app, esClient };
