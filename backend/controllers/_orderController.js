import Order from "../models/_order.js";
import { responseHandler } from '../utils/index.js';

const OrderController = {
    /* get all orders (only admin) */
    get_orders: async (req, res) => {
        try {
            const orders = await Order.find();
            responseHandler(res, HttpStatus.OK, 'success', '', { orders });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    /* get monthly income (only admin) */
    get_income: async (req, res) => {
        const date = new Date();
        const lastMonth = new Date(date.setMonth(date.getMonth() - 1));
        const previousMonth = new Date(new Date().setMonth(lastMonth.getMonth() - 1));

        try {
            const income = await Order.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: previousMonth
                        }
                    },
                },
                {
                    $project: {
                        month: { $month: "$createdAt" },
                        sales: "$amount",
                    },
                },
                {
                    $group: {
                        _id: "$month",
                        total: { $sum: "$sales" }
                    }
                },
            ]);
            responseHandler(res, HttpStatus.OK, 'success', '', { income });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    /* get user's orders */
    get_order: async (req, res) => {
        try {
            const orders = await Order.findOne({ userId: req.params.userId });
            if (!orders) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "User doesn't exist");
            } else {
                responseHandler(res, HttpStatus.OK, 'success', '', { orders });
            }
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    /* add order */
    create_order: async (req, res) => {
        try {
            const userId = req.user.id; // Extract user ID from authenticated user
            const newOrder = new Order({ ...req.body, userId });
            const savedOrder = await newOrder.save();
            responseHandler(res, HttpStatus.CREATED, 'success', 'Order created successfully', { savedOrder });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    /* update order */
    update_order: async (req, res) => {
        try {
            const updatedOrder = await Order.findByIdAndUpdate(req.params.id, {
                $set: req.body
            }, { new: true });
            responseHandler(res, HttpStatus.OK, 'success', 'Order updated successfully', { updatedOrder });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    },

    /* delete order */
    delete_order: async (req, res) => {
        try {
            await Order.findByIdAndDelete(req.params.id);
            responseHandler(res, HttpStatus.OK, 'success', 'Order has been deleted successfully');
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
        }
    }
};

export default OrderController;
