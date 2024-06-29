import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { authRoute, userRoute, productRoute, cartRoute, orderRoute, shippingRoute, reviewRoute } from "./routes/index.js";
import { appLogger } from "./middlewares/_logger.js";
import { checkCache, cacheResponse } from "./middlewares/_caching.js";
import Pagination from "./middlewares/_pagination.js";
import { swaggerOptions } from "./swaggerConfig.js";
import { synchronizeProducts } from "./services/_elasticsearch.js";

dotenv.config();
const app = express();

// Use CORS middleware
app.use(cors());

// Middleware configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(appLogger);

// Swagger setup
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Route definitions
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", Pagination, userRoute);
app.use("/api/v1/products", checkCache, cacheResponse(300), Pagination, productRoute);
app.use("/api/v1/carts", checkCache, cacheResponse(300), cartRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/shipping", checkCache, cacheResponse(300), shippingRoute);
app.use("/api/v1/review", Pagination, reviewRoute);

// Database connection
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Successfully connected to the database");

    // Synchronize products with Elasticsearch
    await synchronizeProducts();
  } catch (err) {
    console.error("Could not connect to the database:", err);
    process.exit(1);
  }
}

connectToDatabase();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
