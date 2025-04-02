import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: {
                type: Number,
                default: 1,
                min: 1
            }
        }
    ],
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    address: {
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
        default: "pending"
    },
    version: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Ensure indexes are only defined once
const existingIndexes = OrderSchema.indexes();
if (!existingIndexes.some(index => JSON.stringify(index[0]) === JSON.stringify({ userId: 1 }))) {
    OrderSchema.index({ userId: 1 });
}

// Virtual field for total items
OrderSchema.virtual('totalItems').get(function () {
    return this.products.reduce((total, item) => total + item.quantity, 0);
});

OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

// Prevent OverwriteModelError
const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;
