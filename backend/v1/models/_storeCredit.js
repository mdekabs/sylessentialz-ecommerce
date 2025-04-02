import mongoose from "mongoose";

const StoreCreditSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // Ensures one store credit record per user
            index: true // Improves query speed when searching by user
        },
        amount: {
            type: Number,
            default: 0,
            min: 0 // Ensures store credit cannot be negative
        },
        expiryDate: {
            type: Date,
            default: null,
            index: true // Index for efficient expiration queries
        },
        version: {
            type: Number,
            default: 0 // For optimistic locking
        }
    },
    { timestamps: true }
);

// TTL index to auto-remove expired credits (optional, uncomment if desired)
// StoreCreditSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

// Virtual to check if credit is active
StoreCreditSchema.virtual('isActive').get(function () {
    return this.amount > 0 && (!this.expiryDate || this.expiryDate > new Date());
});

StoreCreditSchema.set('toJSON', { virtuals: true });
StoreCreditSchema.set('toObject', { virtuals: true });

const StoreCredit = mongoose.model("StoreCredit", StoreCreditSchema);

export default StoreCredit;
