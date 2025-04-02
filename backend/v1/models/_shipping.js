import mongoose from 'mongoose';

/**
 * Mongoose schema for shipping details.
 * Tracks shipping information related to an order.
 */
const ShippingSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,           // Must link to an order
        ref: 'Order'              // References the Order model
    },
    trackingNumber: {
        type: String,
        required: true,           // Unique tracking identifier
        unique: true              // Ensures no duplicate tracking numbers
    },
    carrier: {
        type: String,
        required: true            // Shipping provider (e.g., UPS, FedEx)
    },
    status: {
        type: String,
        enum: ['pending', 'shipped', 'in-transit', 'delivered', 'cancelled'],
                                  // Restricts status to valid states
        default: 'pending'        // Initial status for new shipments
    },
    estimatedDeliveryDate: {
        type: Date                // Projected delivery date (optional)
    },
    actualDeliveryDate: {
        type: Date                // Date of actual delivery (optional)
    }
}, { timestamps: true });         // Adds createdAt and updatedAt fields

/**
 * Mongoose model for the Shipping collection.
 * @type {mongoose.Model}
 */
const Shipping = mongoose.model('Shipping', ShippingSchema);

export default Shipping;
