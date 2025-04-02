import mongoose from "mongoose";

/**
 * Mongoose schema for store credit.
 * Manages user-specific credit balances with expiration tracking.
 */
const StoreCreditSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",              // References the User model
            required: true,           // Must link to a user
            unique: true,             // One credit record per user
            index: true               // Optimizes queries by userId
        },
        amount: {
            type: Number,
            default: 0,               // Starts at 0 if not specified
            min: 0                    // Prevents negative credit balances
        },
        expiryDate: {
            type: Date,
            default: null,            // No expiration by default
            index: true               // Speeds up expiration-based queries
        },
        version: {
            type: Number,
            default: 0                // Supports optimistic concurrency control
        }
    },
    { timestamps: true }              // Adds createdAt and updatedAt fields
);

// Optional TTL index to auto-remove expired credits
// StoreCreditSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 }); // Uncomment to enable auto-deletion

/**
 * Virtual property to determine if store credit is active.
 * Checks if amount is positive and not expired.
 * @returns {boolean} True if credit is active, false otherwise
 */
StoreCreditSchema.virtual('isActive').get(function () {
    return this.amount > 0 && (!this.expiryDate || this.expiryDate > new Date());
});

// Enable virtuals in JSON and object output
StoreCreditSchema.set('toJSON', { virtuals: true });    // Includes virtuals in JSON responses
StoreCreditSchema.set('toObject', { virtuals: true });  // Includes virtuals in object conversions

/**
 * Mongoose model for the StoreCredit collection.
 * @type {mongoose.Model}
 */
const StoreCredit = mongoose.model("StoreCredit", StoreCreditSchema);

export default StoreCredit;
