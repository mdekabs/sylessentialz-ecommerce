import mongoose from "mongoose";

const storeCreditSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // Improves query speed when searching by user
        },
        amount: {
            type: Number,
            default: 0,
            min: 0, // Ensures store credit cannot be negative
        },
        expiryDate: {
            type: Date,
            default: null,
            index: { expireAfterSeconds: 0 }, // Auto-remove expired credits (optional)
        },
    },
    { timestamps: true }
);

const StoreCredit = mongoose.model("StoreCredit", storeCreditSchema);

export default StoreCredit;
