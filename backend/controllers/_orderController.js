import Order from "../models/_order.js";

const OrderController = {
    /* get all orders (only admin) */
    get_orders: async (req, res) => {
        try {
            const orders = await Order.find();
            res.status(200).json({
                type: "success",
                orders
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
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
            res.status(200).json({
                type: "success",
                income
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
        }
    },

    /* get user's orders */
    get_order: async (req, res) => {
        try {
            const orders = await Order.findOne({ userId: req.params.userId });
            if (!orders) {
                res.status(404).json({
                    type: "error",
                    message: "User doesn't exist"
                });
            } else {
                res.status(200).json({
                    type: "success",
                    orders
                });
            }
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
        }
    },

    /* add order */
    create_order: async (req, res) => {
        try {
            const userId = req.user.id; // Extract user ID from authenticated user
            const newOrder = new Order({ ...req.body, userId });
            const savedOrder = await newOrder.save();
            res.status(201).json({
                type: "success",
                message: "Order created successfully",
                savedOrder
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
        }
    },

    /* update order */
    update_order: async (req, res) => {
        try {
            const updatedOrder = await Order.findByIdAndUpdate(req.params.id, {
                $set: req.body
            }, { new: true });
            res.status(200).json({
                type: "success",
                message: "Order updated successfully",
                updatedOrder
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
        }
    },

    /* delete order */
    delete_order: async (req, res) => {
        try {
            await Order.findByIdAndDelete(req.params.id);
            res.status(200).json({
                type: "success",
                message: "Order has been deleted successfully"
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
        }
    }
};

export default OrderController;
