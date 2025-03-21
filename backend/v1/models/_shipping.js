import mongoose from 'mongoose';

const ShippingSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Order'
    },
    trackingNumber: {
        type: String,
        required: true,
        unique: true
    },
    carrier: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'shipped', 'in-transit', 'delivered', 'cancelled'],
        default: 'pending'
    },
    estimatedDeliveryDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    }
}, { timestamps: true });

const Shipping = mongoose.model('Shipping', ShippingSchema);

export default Shipping;
