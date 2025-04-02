import mongoose from "mongoose";
import mongoosastic from "mongoosastic";
import { esClient } from "../elasticsearch.js";

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, es_indexed: true },
    description: { type: String, es_indexed: true },
    price: { type: Number, required: true, es_indexed: true },
    category: { type: String, required: true, es_indexed: true },
    image: { type: String, required: true, es_indexed: true },
    stock: { 
        type: Number, 
        required: true, 
        min: 0, 
        default: 0, 
        es_indexed: true // Add to Elasticsearch if needed
    },
    version: { 
        type: Number, 
        default: 0 // For optimistic locking
    }
}, { timestamps: true });

ProductSchema.plugin(mongoosastic, {
    esClient,
    index: "products",
    bulk: {
        size: 1000,
        delay: 100, // Milliseconds
    },
    indexAutomatically: false
});

const Product = mongoose.model("Product", ProductSchema);

async function syncProducts() {
    try {
        console.log("🔄 Syncing products with Elasticsearch...");

        const indexExists = await esClient.indices.exists({ index: "products" });

        if (!indexExists) {
            await esClient.indices.create({
                index: "products",
                body: {
                    mappings: {
                        properties: {
                            name: { type: "text" },
                            description: { type: "text" },
                            price: { type: "float" },
                            category: { type: "keyword" },
                            image: { type: "text" },
                            stock: { type: "integer" }
                        }
                    }
                }
            });
            console.log("✅ Created 'products' index with updated mapping.");
        } else {
            console.log("✅ 'products' index already exists. Skipping creation.");
        }

        const batchSize = 100;
        let page = 1;

        while (true) {
            const products = await Product.find()
                .lean()
                .skip((page - 1) * batchSize)
                .limit(batchSize);

            if (products.length === 0) break;

            const bulkBody = products.flatMap(doc => {
                const { _id, version, ...docWithoutIdAndVersion } = doc; // Exclude version from Elasticsearch
                return [{ index: { _index: "products", _id: _id.toString() } }, docWithoutIdAndVersion];
            });

            const { errors } = await esClient.bulk({ body: bulkBody });
            if (errors) {
                console.error("❌ Bulk indexing errors:", errors);
            }

            page++;
            console.log(`✅ Processed batch ${page - 1}`);
        }

        console.log("✅ Products successfully synced to Elasticsearch.");
    } catch (error) {
        console.error("❌ Elasticsearch sync error:", error);
        throw error;
    }
}

export { Product, syncProducts };
