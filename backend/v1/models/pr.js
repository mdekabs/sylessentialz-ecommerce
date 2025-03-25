import mongoose from "mongoose";
import mongoosastic from "mongoosastic";
import { esClient } from "../elasticsearch.js";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, es_indexed: true },
  description: { type: String, es_indexed: true },
  price: { type: Number, required: true, es_indexed: true },
  category: { type: String, required: true, es_indexed: true },
});

ProductSchema.plugin(mongoosastic, {
  esClient,
  index: "products",
  bulk: { size: 1000, delay: "100ms" },
});

const Product = mongoose.model("Product", ProductSchema);

async function syncProducts() {
  try {
    console.log("🔄 Syncing products with Elasticsearch...");

    // Delete existing index to avoid type conflicts
    const indexExists = await esClient.indices.exists({ index: "products" });
    if (indexExists) {
      await esClient.indices.delete({ index: "products" });
      console.log("🗑️ Deleted existing 'products' index.");
    }

    // Create new index with correct mapping
    await esClient.indices.create({
      index: "products",
      body: {
        mappings: {
          properties: {
            name: { type: "text" },
            description: { type: "text" },
            price: { type: "float" },
            category: { type: "keyword" },
          },
        },
      },
    });

    console.log("✅ Created 'products' index with updated mapping.");

    const batchSize = 100;
    let page = 1;
    let maxAttempts = 10; // Prevent infinite loops

    while (maxAttempts > 0) {
      const products = await Product.find()
        .lean()
        .skip((page - 1) * batchSize)
        .limit(batchSize);

      if (products.length === 0) break;

      const bulkResponse = await esClient.bulk({
        body: products.flatMap((doc) => [
          { index: { _index: "products" } },
          doc,
        ]),
      });

      if (bulkResponse.errors) {
        console.error("❌ Bulk indexing errors:", JSON.stringify(bulkResponse, null, 2));
      }

      page++;
      maxAttempts--;
      console.log(`✅ Processed batch ${page - 1}`);
    }

    console.log("✅ Products successfully synced to Elasticsearch.");
  } catch (error) {
    console.error("❌ Elasticsearch sync error:", error);
    throw error;
  }
}

export { Product, syncProducts };
