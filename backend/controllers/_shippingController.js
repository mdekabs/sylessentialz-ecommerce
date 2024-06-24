
import Shipping from '../models/_shipping.js';
import { v4 as uuidv4 } from 'uuid';

const ShippingController = {
    async createShipment(req, res) {
        const { orderId, carrier, estimatedDeliveryDate } = req.body;
        
        try {
            // Generate a unique tracking number
            const trackingNumber = `${carrier.toUpperCase()}-${uuidv4()}`;
            
            const newShipment = new Shipping({
                orderId,
                trackingNumber,
                carrier,
                estimatedDeliveryDate
            });
            
            const savedShipment = await newShipment.save();
            
            res.status(201).json({
                type: 'success',
                message: 'Shipment created successfully',
                savedShipment
            });
        } catch (err) {
            res.status(500).json({
                type: 'error',
                message: 'Something went wrong, please try again',
                err
            });
        }
    },

    async getShipment(req, res) {
        try {
            const shipment = await Shipping.findById(req.params.id);
            
            if (!shipment) {
                return res.status(404).json({
                    type: 'error',
                    message: 'Shipment not found'
                });
            }
            
            res.status(200).json({
                type: 'success',
                shipment
            });
        } catch (err) {
            res.status(500).json({
                type: 'error',
                message: 'Something went wrong, please try again',
                err
            });
        }
    },

    async updateShipment(req, res) {
        try {
            const shipment = await Shipping.findById(req.params.id);
            
            if (!shipment) {
                return res.status(404).json({
                    type: 'error',
                    message: 'Shipment not found'
                });
            }
            
            const updatedShipment = await Shipping.findByIdAndUpdate(req.params.id, req.body, { new: true });
            
            res.status(200).json({
                type: 'success',
                message: 'Shipment updated successfully',
                updatedShipment
            });
        } catch (err) {
            res.status(500).json({
                type: 'error',
                message: 'Something went wrong, please try again',
                err
            });
        }
    },

    async deleteShipment(req, res) {
        try {
            const shipment = await Shipping.findById(req.params.id);
            
            if (!shipment) {
                return res.status(404).json({
                    type: 'error',
                    message: 'Shipment not found'
                });
            }
            
            await Shipping.findByIdAndDelete(req.params.id);
            
            res.status(200).json({
                type: 'success',
                message: 'Shipment deleted successfully'
            });
        } catch (err) {
            res.status(500).json({
                type: 'error',
                message: 'Something went wrong, please try again',
                err
            });
        }
    }
};

export default ShippingController;
