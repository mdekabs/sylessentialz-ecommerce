import mongoose from "mongoose";

const CartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            sparse: true, // ✅ Implicitly creates an index (no need for manual .index())
        },
        guestId: {
            type: String,
            sparse: true, // ✅ Implicitly creates an index (no need for manual .index())
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                quantity: {
                    type: Number,
                    default: 1,
                    min: 1,
                },
            },
        ],
        lastUpdated: {
            type: Date,
            default: Date.now,
            index: true, // ✅ This index is fine for optimizing cleanup
        },
        version: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Virtual for total price
CartSchema.virtual("totalPrice").get(function () {
    if (!this.populated("products.productId")) {
        return 0;
    }
    return this.products.reduce((total, item) => {
        const price = item.productId?.price || 0;
        return total + price * item.quantity;
    }, 0);
});

// Enable virtuals in JSON and object output
CartSchema.set("toJSON", { virtuals: true });
CartSchema.set("toObject", { virtuals: true });

// ❌ Remove these duplicate manual indexes
// CartSchema.index({ userId: 1 });
// CartSchema.index({ guestId: 1 });

export default mongoose.model("Cart", CartSchema);
