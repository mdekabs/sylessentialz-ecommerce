import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
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
                }
            }
        ],
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        address: {
            type: Object,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
            default: "pending",
        }
    },
    { timestamps: true }
);

// Index userId to optimize queries
OrderSchema.index({ userId: 1 });

export default mongoose.model("Order", OrderSchema);
