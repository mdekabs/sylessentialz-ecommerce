import mongoose from "mongoose";

/**
 * Mongoose schema for an order.
 * Represents a user's purchase with product details and status tracking.
 */
const OrderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",                  // References the User model
            required: true                // Ensures every order is tied to a user
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",       // References the Product model
                    required: true        // Ensures each item references a product
                },
                quantity: {
                    type: Number,
                    default: 1,           // Defaults to 1 item if not specified
                    min: 1                // Prevents negative or zero quantities
                }
            }
        ],
        amount: {
            type: Number,
            required: true,           // Total order amount must be provided
            min: 0                    // Ensures amount is non-negative
        },
        address: {
            type: Object,             // Flexible structure for shipping address
            required: true            // Ensures delivery address is provided
        },
        status: {
            type: String,
            enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
                                      // Restricts status to valid states
            default: "pending"        // Initial status for new orders
        },
        version: {
            type: Number,
            default: 0                // Supports optimistic concurrency control
        }
    },
    { timestamps: true }              // Adds createdAt and updatedAt fields
);

// Index to optimize queries by userId
OrderSchema.index({ userId: 1 });     // Enhances performance for user-specific order lookups

/**
 * Virtual property to calculate the total number of items in the order.
 * Sums the quantities of all products.
 * @returns {number} Total number of items
 */
OrderSchema.virtual('totalItems').get(function () {
    return this.products.reduce((total, item) => total + item.quantity, 0);
});

// Enable virtuals in JSON and object output
OrderSchema.set('toJSON', { virtuals: true });    // Includes virtuals in JSON responses
OrderSchema.set('toObject', { virtuals: true });  // Includes virtuals in object conversions

/**
 * Mongoose model for the Order collection.
 * @type {mongoose.Model}
 */
export default mongoose.model("Order", OrderSchema);
