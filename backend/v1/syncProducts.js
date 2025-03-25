import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/product.js";

dotenv.config();

async function syncProductsToElasticsearch() {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const products = await Product.find();
    products.forEach(product => {
        product.on("es-indexed", (err, result) => {
            if (err) console.error("❌ Error indexing:", err);
            else console.log("✅ Indexed:", result);
        });
        product.save(); // Triggers Elasticsearch indexing
    });

    console.log("✅ MongoDB products synced to Elasticsearch!");
    process.exit();
}

syncProductsToElasticsearch();
