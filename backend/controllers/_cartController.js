import Cart from "../models/_cart.js";

const CartController = {
    // Get all carts (admin only)
    async get_carts(req, res) {
        try {
            const carts = await Cart.find();
            res.status(200).json({
                type: "success",
                carts,
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err,
            });
        }
    },

    // Get the authenticated user's cart
    async get_cart(req, res) {
        try {
            const cart = await Cart.findOne({ userId: req.user.id });
            if (!cart) {
                res.status(404).json({
                    type: "error",
                    message: "Cart not found",
                });
            } else {
                res.status(200).json({
                    type: "success",
                    cart,
                });
            }
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err,
            });
        }
    },

    // Create a new cart
    async create_cart(req, res) {
        const newCart = new Cart({
            userId: req.user.id, // Get userId from the authenticated user
            products: req.body.products,
        });

        try {
            const savedCart = await newCart.save();
            res.status(201).json({
                type: "success",
                message: "Cart created successfully",
                savedCart,
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err,
            });
        }
    },

    // Update a cart
    async update_cart(req, res) {
        try {
            const updatedCart = await Cart.findByIdAndUpdate(
                req.params.id,
                {
                    $set: req.body,
                },
                { new: true }
            );
            res.status(200).json({
                type: "success",
                message: "Cart updated successfully",
                updatedCart,
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err,
            });
        }
    },

    // Delete a cart
    async delete_cart(req, res) {
        try {
            await Cart.findByIdAndDelete(req.params.id);
            res.status(200).json({
                type: "success",
                message: "Cart deleted successfully",
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err,
            });
        }
    },
};

export default CartController;
