// elasticsearch.js
import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
import { logger } from "./middlewares/index.js";

dotenv.config();

let esClient;

async function initializeElasticsearch() {
    if (!esClient) {
        esClient = new Client({
            node: process.env.ELASTICSEARCH_URI || "http://localhost:9200",
            maxRetries: 5,
            requestTimeout: 60000,
        });

        try {
            const esHealth = await esClient.cluster.health({ timeout: "10s" });
            logger.info(`✅ Elasticsearch connected: Status is ${esHealth.status}`);
            if (esHealth.status === "yellow" && process.env.NODE_ENV !== "production") {
                await configureElasticsearch();
            }
        } catch (error) {
            logger.error("⚠️ Elasticsearch connection issue (non-critical):", error.message);
        }
    }
    return esClient;
}

async function configureElasticsearch() {
    try {
        await esClient.indices.putSettings({
            index: { number_of_replicas: 0 },
        });
        logger.info("✅ Elasticsearch settings updated: replicas set to 0");
    } catch (err) {
        logger.error("⚠️ Failed to update Elasticsearch settings:", err.message);
    }
}

export { initializeElasticsearch, esClient };
