import mongoose from "mongoose";

/**
 * Mongoose schema for a product.
 * Defines product details with strict validation.
 */
const ProductSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,           // Product must have a name
        trim: true,               // Remove leading/trailing whitespace
        minlength: 3,             // Minimum length for name
        maxlength: 100            // Maximum length for name
    },
    description: { 
        type: String, 
        trim: true,               // Remove leading/trailing whitespace
        maxlength: 1000           // Maximum length for description
    },
    price: { 
        type: Number, 
        required: true,           // Price is mandatory
        min: 0,                   // Prevent negative or zero prices
        max: 1000000              // Reasonable upper limit for price
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
        ]
    },
    image: { 
        type: String, 
        required: true,           // Image URL is mandatory
        match: /^https?:\/\/.+\.(png|jpg|jpeg|gif)$/i // Validate image URL format
    },
    stock: { 
        type: Number, 
        required: true,           // Stock quantity is mandatory
        min: 0,                   // Prevents negative stock
        max: 100000,              // Reasonable upper limit for stock
        default: 0                // Defaults to 0 if not specified
    },
    version: { 
        type: Number, 
        default: 0                // Supports optimistic locking in MongoDB
    }
}, { timestamps: true });         // Adds createdAt and updatedAt fields

/**
 * Mongoose model for the Product collection.
 * @type {mongoose.Model}
 */
const Product = mongoose.model("Product", ProductSchema);

export { Product };