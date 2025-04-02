import mongoose from "mongoose";

/**
 * Mongoose schema for a shopping cart.
 * Supports both authenticated users and guest users with product references.
 */
const CartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // References the User model
            sparse: true, // Allows null values and creates an index implicitly
        },
        guestId: {
            type: String,
            sparse: true, // Allows null values and creates an index implicitly
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product", // References the Product model
                    required: true, // Ensures every cart item references a product
                },
                quantity: {
                    type: Number,
                    default: 1, // Default quantity for a product
                    min: 1, // Ensures quantity is at least 1
                },
            },
        ],
        lastUpdated: {
            type: Date,
            default: Date.now, // Automatically set to current date/time
            index: true, // Optimizes queries for cleanup or sorting by last update
        },
        version: {
            type: Number,
            default: 0, // Tracks cart version for potential optimistic locking
        },
    },
    { timestamps: true } // Adds createdAt and updatedAt fields automatically
);

/**
 * Virtual property to calculate the total price of items in the cart.
 * Requires products.productId to be populated with price data.
 * @returns {number} Total price of all products in the cart
 */
CartSchema.virtual("totalPrice").get(function () {
    if (!this.populated("products.productId")) {
        return 0; // Return 0 if product references aren't populated
    }
    return this.products.reduce((total, item) => {
        const price = item.productId?.price || 0; // Fallback to 0 if price is unavailable
        return total + price * item.quantity;
    }, 0);
});

// Configure schema to include virtuals in JSON and object conversions
CartSchema.set("toJSON", { virtuals: true });
CartSchema.set("toObject", { virtuals: true });

// Note: Manual indexes on userId and guestId are unnecessary due to sparse: true
// CartSchema.index({ userId: 1 }); // Removed - redundant with sparse index
// CartSchema.index({ guestId: 1 }); // Removed - redundant with sparse index

/**
 * Mongoose model for the Cart collection.
 * @type {mongoose.Model}
 */
export default mongoose.model("Cart", CartSchema);
