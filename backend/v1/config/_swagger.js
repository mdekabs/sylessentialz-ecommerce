import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the YAML file
const swaggerDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));

/**
 * Function to setup Swagger UI
 * @param {import('express').Express} app - Express app instance
 */
export const setupSwaggerDocs = (app) => {
  const options = {
    customSiteTitle: "My API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  };

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

  console.log("✅ Swagger UI available at /api-docs");
};