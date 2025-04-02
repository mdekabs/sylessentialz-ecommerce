import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import { connectToDatabase } from "./db.js";
import { esClient } from "./elasticsearch.js";
import { syncProducts } from "./models/index.js";
import { 
    authRoute, 
    userRoute, 
    productRoute, 
    cartRoute, 
    orderRoute 
} from "./routes/index.js";
import { responseHandler, cleanupExpiredCarts } from "./utils/index.js";
import { appLogger, errorLogger, logger } from "./middlewares/index.js";
import { swaggerOptions } from "./swaggerConfig.js";

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));
app.use(appLogger);

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/carts", cartRoute);
app.use("/api/v1/orders", orderRoute);

app.get("/api/v1/health", asyncHandler(async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const esStatus = await esClient.ping()
        .then(() => "connected")
        .catch(() => "disconnected");
    
    res.status(200).json({ 
        status: "ok", 
        database: dbStatus, 
        elasticsearch: esStatus 
    });
}));

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
    responseHandler(res, statusCode, "error", error.message || "Internal server error");
});

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectToDatabase();
        await esClient.ping();

        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                await syncProducts();
                break;
            } catch (error) {
                retryCount++;
                if (retryCount === maxRetries) {
                    throw error;
                }
                logger.warn(`Sync failed, retrying in 5 seconds... (Attempt ${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        cleanupExpiredCarts();
        logger.info("✅ Cart cleanup scheduler started");

        const server = app.listen(PORT, () => {
            logger.info(`🚀 Sylessentials ecommerce Server is running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
        });

        process.on("SIGTERM", async () => {
            logger.info("SIGTERM signal received: closing HTTP server");
            await mongoose.connection.close();
            server.close(() => {
                logger.info("HTTP server closed");
                process.exit(0);
            });
        });
    } catch (error) {
        logger.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

export { app, startServer };
