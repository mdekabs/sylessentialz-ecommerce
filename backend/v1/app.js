import express from "express";
import { logger, appLogger, errorLogger } from "./config/_logger.js";
import routes from "./routes/index.js";
import { errorMiddleware } from "./middlewares/_errorMiddleware.js";

const app = express();

// Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging Middleware
app.use(appLogger);

// API Routes
app.use("/api", routes);

// Error Handling Middlewares
app.use(errorLogger);
app.use(errorMiddleware);

export default app;