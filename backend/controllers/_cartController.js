import HttpStatus from 'http-status-codes';
import Cart from "../models/_cart.js";
import { responseHandler } from '../utils/index.js';

const CartController = {
    // Get all carts (admin only)
    get_carts: async (req, res) => {
        try {
            const carts = await Cart.find();
            responseHandler(res, HttpStatus.OK, "success", "", { carts });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    // Get the authenticated user's cart
    get_cart: async (req, res) => {
        try {
            const cart = await Cart.findOne({ userId: req.user.id });
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Cart not found");
            } else {
                responseHandler(res, HttpStatus.OK, "success", "", { cart });
            }
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    // Create a new cart
    create_cart: async (req, res) => {
        const newCart = new Cart({
            userId: req.user.id, // Get userId from the authenticated user
            products: req.body.products,
        });

        try {
            const savedCart = await newCart.save();
            responseHandler(res, HttpStatus.CREATED, "success", "Cart created successfully", { savedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    // Update a cart
    update_cart: async (req, res) => {
        try {
            const updatedCart = await Cart.findByIdAndUpdate(
                req.params.id,
                {
                    $set: req.body,
                },
                { new: true }
            );
            responseHandler(res, HttpStatus.OK, "success", "Cart updated successfully", { updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    // Delete a cart
    delete_cart: async (req, res) => {
        try {
            await Cart.findByIdAndDelete(req.params.id);
            responseHandler(res, HttpStatus.OK, "success", "Cart deleted successfully");
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },
};

export default CartController;
