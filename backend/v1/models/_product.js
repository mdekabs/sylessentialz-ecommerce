import mongoose from "mongoose";
import mongoosastic from "mongoosastic";

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true, index: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 1000 },
    image: { type: String, required: true },
    categories: { type: [String], index: true },
    price: { type: Number, required: true, min: 0 },
}, { timestamps: true });

const syncElasticSearch = async () => {
    if (!global.esClient) {
        throw new Error("Elasticsearch client is not initialized");
    }

    try {
        await global.esClient.ping();
        console.log("✅ Elasticsearch connection verified in Product model");

        const stream = Product.find().cursor();
        let count = 0;

        return new Promise((resolve, reject) => {
            stream.on("data", async doc => {
                stream.pause();
                try {
                    await doc.index();
                    count++;
                } catch (err) {
                    console.error(`❌ Failed to index product ${doc._id}:`, err);
                }
                stream.resume();
            });

            stream.on("end", () => {
                console.log(`✅ Synced ${count} products to Elasticsearch`);
                resolve(count);
            });

            stream.on("error", reject);
        });
    } catch (error) {
        console.error("❌ Sync Failed:", error);
        throw error;
    }
};

ProductSchema.plugin(mongoosastic, { esClient: global.esClient });

const Product = mongoose.model("Product", ProductSchema);
export { Product, syncElasticSearch };
