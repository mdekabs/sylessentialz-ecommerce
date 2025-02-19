import mongoose from 'mongoose';
import mongoosastic from 'mongoose-elasticsearch-xp';

const ProductSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true
    },
    categories: {
        type: Array,
    },
    size: {
        type: String
    },
    color: {
        type: String
    },
    price: {
        type: Number,
        required: true
    }
}, { timestamps: true });

ProductSchema.plugin(mongoosastic, {
    hosts: process.env.ELASTICSEARCH_URI || "localhost:9200"
});

const Product = mongoose.model('Product', ProductSchema);

export default Product;
