import mongoose from "mongoose";
import mongoosastic from "mongoose-elasticsearch-xp";

const ProductSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            unique: true,
            index: true,
            maxlength: 100,
        },
        description: {
            type: String,
            required: true,
            maxlength: 1000,
        },
        image: {
            type: String,
            required: true,
            validate: {
                validator: function (v) {
                    return /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))$/i.test(v);
                },
                message: (props) => `${props.value} is not a valid image URL!`,
            },
        },
        categories: {
            type: [String], // Ensures it's an array of strings
            index: true,
            validate: {
                validator: function (v) {
                    return v.length <= 10; // Limit categories to 10 items max
                },
                message: "A product can have at most 10 categories.",
            },
        },
        price: {
            type: Number,
            required: true,
            min: 0, // Ensures price is non-negative
        },
    },
    { timestamps: true }
);

// Elasticsearch Integration
ProductSchema.plugin(mongoosastic, {
    hosts: process.env.ELASTICSEARCH_URI || "localhost:9200",
});

const Product = mongoose.model("Product", ProductSchema);

export default Product;
