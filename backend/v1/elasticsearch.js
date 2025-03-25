import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

const esClient = new Client({
    node: process.env.ELASTICSEARCH_URI || "http://localhost:9200",
    maxRetries: 5,
    requestTimeout: 60000,
});

async function checkElasticsearch() {
    try {
        const health = await esClient.cluster.health();
        console.log(`✅ Elasticsearch Connected: ${health.status}`);
    } catch (error) {
        console.error("❌ Elasticsearch Connection Failed:", error.message);
    }
}

checkElasticsearch();

export { esClient };
