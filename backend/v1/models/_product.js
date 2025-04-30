import mongoose from "mongoose";
import mongoosastic from "mongoosastic";
import { esClient } from "../elasticsearch.js";

/**
 * Mongoose schema for a product.
 * Defines product details with Elasticsearch indexing support and strict validation.
 */
const ProductSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,           // Product must have a name
        trim: true,               // Remove leading/trailing whitespace
        minlength: 3,             // Minimum length for name
        maxlength: 100,           // Maximum length for name
        es_indexed: true          // Indexed in Elasticsearch for search
    },
    description: { 
        type: String, 
        trim: true,               // Remove leading/trailing whitespace
        maxlength: 1000,          // Maximum length for description
        es_indexed: true          // Indexed for full-text search
    },
    price: { 
        type: Number, 
        required: true,           // Price is mandatory
        min: 0,                   // Prevent negative or zero prices
        max: 1000000,             // Reasonable upper limit for price
        es_indexed: true          // Indexed for filtering/sorting
    },
    category: { 
        type: String, 
        required: true,           // Category is mandatory
        enum: [                   // Restrict to predefined categories
            'electronics', 
            'clothing', 
            'books', 
            'home', 
            'toys', 
            'sports'
        ],
        es_indexed: true          // Indexed as keyword for exact match
    },
    image: { 
        type: String, 
        required: true,           // Image URL is mandatory
        match: /^https?:\/\/.+\.(png|jpg|jpeg|gif)$/i, // Validate image URL format
        es_indexed: true          // Indexed for potential search
    },
    stock: { 
        type: Number, 
        required: true,           // Stock quantity is mandatory
        min: 0,                   // Prevents negative stock
        max: 100000,              // Reasonable upper limit for stock
        default: 0,               // Defaults to 0 if not specified
        es_indexed: true          // Indexed for availability filtering
    },
    version: { 
        type: Number, 
        default: 0                // Supports optimistic locking in MongoDB
    }
}, { timestamps: true });         // Adds createdAt and updatedAt fields

// Integrate mongoosastic for Elasticsearch synchronization
ProductSchema.plugin(mongoosastic, {
    esClient,                     // Elasticsearch client instance
    index: "products",            // Target Elasticsearch index
    bulk: {
        size: 1000,               // Number of docs per bulk operation
        delay: 100,               // Delay between bulk ops in ms
    },
    indexAutomatically: false     // Manual indexing control
});

/**
 * Mongoose model for the Product collection.
 * @type {mongoose.Model}
 */
const Product = mongoose.model("Product", ProductSchema);

/**
 * Synchronizes MongoDB products with Elasticsearch.
 * Creates index if missing and bulk indexes products in batches.
 * @returns {Promise<void>}
 * @throws {Error} If sync fails
 */
async function syncProducts() {
    try {
        console.log("🔄 Syncing products with Elasticsearch...");

        // Check if 'products' index exists in Elasticsearch
        const indexExists = await esClient.indices.exists({ index: "products" });

        if (!indexExists) {
            // Create index with custom mappings if it doesn't exist
            await esClient.indices.create({
                index: "products",
                body: {
                    mappings: {
                        properties: {
                            name: { type: "text" },        // Full-text search
                            description: { type: "text" }, // Full-text search
                            price: { type: "float" },      // Numeric filtering
                            category: { type: "keyword" }, // Exact match
                            image: { type: "text" },       // Searchable URL
                            stock: { type: "integer" }     // Stock filtering
                        }
                    }
                }
            });
            console.log("✅ Created 'products' index with updated mapping.");
        } else {
            console.log("✅ 'products' index already exists. Skipping creation.");
        }

        const batchSize = 100;     // Number of products per batch
        let page = 1;              // Pagination tracker

        while (true) {
            // Fetch products in batches from MongoDB
            const products = await Product.find()
                .lean()            // Return plain JS objects
                .skip((page - 1) * batchSize)
                .limit(batchSize);

            if (products.length === 0) break; // Exit when no more products

            // Prepare bulk indexing payload, excluding version
            const bulkBody = products.flatMap(doc => {
                const { _id, version, ...docWithoutIdAndVersion } = doc;
                return [
                    { index: { _index: "products", _id: _id.toString() } },
                    docWithoutIdAndVersion
                ];
            });

            // Execute bulk indexing
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
        throw error; // Re-throw for upstream handling
    }
}

export { Product, syncProducts };
