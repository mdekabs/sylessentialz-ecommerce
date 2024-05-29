import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { authRoute, userRoute, productRoute, cartRoute, orderRoute } from "./routes/index.js";
import { swaggerOptions } from "./swaggerConfig.js"; // Import the Swagger configuration

dotenv.config();

const app = express();

// Use CORS middleware
app.use(cors());

// Middleware configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger setup
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Route definitions
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/carts", cartRoute);
app.use("/api/v1/orders", orderRoute);

// Database connection
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Successfully connected to the database");
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
