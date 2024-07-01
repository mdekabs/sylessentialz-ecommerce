import Shipping from '../models/_shipping.js';
import { v4 as uuidv4 } from 'uuid';
import { responseHandler } from '../utils/index.js';

const ShippingController = {
    createShipment: async (req, res) => {
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
            
            responseHandler(res, HttpStatus.CREATED, 'success', 'Shipment created successfully', { savedShipment });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    getShipment: async (req, res) => {
        try {
            const shipment = await Shipping.findById(req.params.id);
            
            if (!shipment) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Shipment not found');
            }
            
            responseHandler(res, HttpStatus.OK, 'success', '', { shipment });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    updateShipment: async (req, res) => {
        try {
            const shipment = await Shipping.findById(req.params.id);
            
            if (!shipment) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Shipment not found');
            }
            
            const updatedShipment = await Shipping.findByIdAndUpdate(req.params.id, req.body, { new: true });
            
            responseHandler(res, HttpStatus.OK, 'success', 'Shipment updated successfully', { updatedShipment });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    deleteShipment: async (req, res) => {
        try {
            const shipment = await Shipping.findById(req.params.id);
            
            if (!shipment) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Shipment not found');
            }
            
            await Shipping.findByIdAndDelete(req.params.id);
            
            responseHandler(res, HttpStatus.OK, 'success', 'Shipment deleted successfully');
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    }
};

export default ShippingController;
