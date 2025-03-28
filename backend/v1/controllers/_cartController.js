import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import { Cart } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

const CART_CONSTANTS = {
    DEFAULT_QUANTITY: 1,
    SORT_DEFAULT: 'createdAt',
    ORDER_ASCENDING: 1,
    ORDER_DESCENDING: -1,
    PRODUCTS_VALIDATION_RULES: {
        PRODUCT_ID_REQUIRED: true,
        QUANTITY_MIN_VALUE: 0
    }
};

const ERROR_MESSAGES = {
    CART_NOT_FOUND: "Cart not found",
    INVALID_PRODUCTS_ARRAY: "Valid products array is required",
    CART_ALREADY_EXISTS: "Cart already exists for this user",
    INVALID_PRODUCT_FORMAT: "Invalid product format",
    INVALID_QUANTITY: "Valid quantity (positive number) is required",
    PRODUCT_NOT_FOUND_IN_CART: "Product not found in cart",
    VALID_PRODUCT_ID_REQUIRED: "Valid productId (ObjectId) is required"
};

const SUCCESS_MESSAGES = {
    CARTS_RETRIEVED: "Carts retrieved successfully",
    CART_CREATED: "Cart created successfully",
    CART_UPDATED: "Cart updated successfully",
    ITEM_ADDED: "Item added to cart",
    ITEM_REMOVED: "Item removed from cart",
    CART_CLEARED: "Cart cleared successfully"
};

const CartController = {
    get_carts: async (req, res) => {
        try {
            const { page, limit } = res.locals.pagination;
            const skip = (page - 1) * limit;

            const sort = req.query.sort || CART_CONSTANTS.SORT_DEFAULT;
            const order = req.query.order === 'desc' ? CART_CONSTANTS.ORDER_DESCENDING : CART_CONSTANTS.ORDER_ASCENDING;

            const [totalItems, carts] = await Promise.all([
                Cart.countDocuments(),
                Cart.find()
                    .sort({ [sort]: order })
                    .skip(skip)
                    .limit(limit)
            ]);

            res.locals.setPagination(totalItems);

            const responseData = {
                carts,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages: Math.ceil(totalItems / limit),
                    hasMorePages: res.locals.pagination.hasMorePages,
                    links: res.locals.pagination.links
                }
            };

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CARTS_RETRIEVED, responseData);
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve carts", { error: err.message });
        }
    },

    get_cart: async (req, res) => {
        try {
            const cart = await Cart.findOne({ userId: req.user.id });

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_CREATED, { cart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve cart", { error: err.message });
        }
    },

    get_cart_by_id: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid cart ID");
            }

            const cart = await Cart.findById(id);

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            responseHandler(res, HttpStatus.OK, "success", "Cart retrieved successfully", { cart });
        } catch (err) {
            console.error('Get cart by ID error:', err);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve cart", { error: err.message });
        }
    },

    create_cart: async (req, res) => {
        try {
            if (!req.body.products || !Array.isArray(req.body.products)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
            }

            const existingCart = await Cart.findOne({ userId: req.user.id });
            if (existingCart) {
                return responseHandler(res, HttpStatus.CONFLICT, "error", ERROR_MESSAGES.CART_ALREADY_EXISTS);
            }

            const validProducts = req.body.products.every(product => 
                product.productId && 
                mongoose.Types.ObjectId.isValid(product.productId) &&
                (!product.quantity || (typeof product.quantity === 'number' && product.quantity > CART_CONSTANTS.PRODUCTS_VALIDATION_RULES.QUANTITY_MIN_VALUE))
            );

            if (!validProducts) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCT_FORMAT);
            }

            const newCart = new Cart({
                userId: req.user.id,
                products: req.body.products.map(product => ({
                    productId: new mongoose.Types.ObjectId(product.productId),
                    quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY
                })),
            });

            const savedCart = await newCart.save();
            responseHandler(res, HttpStatus.CREATED, "success", SUCCESS_MESSAGES.CART_CREATED, { cart: savedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to create cart", { error: err.message });
        }
    },

    update_cart: async (req, res) => {
        try {
            const cart = await Cart.findById(req.params.id);

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            if (req.body.products) {
                if (!Array.isArray(req.body.products)) {
                    return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
                }

                const validProducts = req.body.products.every(product => 
                    product.productId && 
                    mongoose.Types.ObjectId.isValid(product.productId) &&
                    (!product.quantity || (typeof product.quantity === 'number' && product.quantity >= CART_CONSTANTS.PRODUCTS_VALIDATION_RULES.QUANTITY_MIN_VALUE))
                );

                if (!validProducts) {
                    return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCT_FORMAT);
                }

                req.body.products = req.body.products.map(product => ({
                    productId: new mongoose.Types.ObjectId(product.productId),
                    quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY
                }));
            }

            const updatedCart = await Cart.findByIdAndUpdate(
                req.params.id,
                { $set: req.body },
                { new: true, runValidators: true }
            );

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_UPDATED, { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to update cart", { error: err.message });
        }
    },

    add_to_cart: async (req, res) => {
        try {
            const { productId, quantity = CART_CONSTANTS.DEFAULT_QUANTITY } = req.body;

            if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED);
            }

            if (typeof quantity !== 'number' || quantity <= CART_CONSTANTS.PRODUCTS_VALIDATION_RULES.QUANTITY_MIN_VALUE) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_QUANTITY);
            }

            let cart = await Cart.findOne({ userId: req.user.id });
            if (!cart) {
                cart = new Cart({ 
                    userId: req.user.id, 
                    products: [] 
                });
            }

            const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
            if (productIndex > -1) {
                cart.products[productIndex].quantity += quantity;
            } else {
                cart.products.push({ 
                    productId: new mongoose.Types.ObjectId(productId), 
                    quantity 
                });
            }

            cart.markModified('products');
            const updatedCart = await cart.save();
            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ITEM_ADDED, { cart: updatedCart });
        } catch (err) {
            console.error('Add to cart error:', err);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to add item to cart", { error: err.message });
        }
    },

    remove_from_cart: async (req, res) => {
        try {
            const { productId } = req.body;

            if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED);
            }

            const cart = await Cart.findOne({ userId: req.user.id });
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
            if (productIndex === -1) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.PRODUCT_NOT_FOUND_IN_CART);
            }

            cart.products.splice(productIndex, 1);
            const updatedCart = await cart.save();
            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ITEM_REMOVED, { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to remove item from cart", { error: err.message });
        }
    },

    clear_cart: async (req, res) => {
        try {
            const cart = await Cart.findOne({ userId: req.user.id });

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            cart.products = [];
            const updatedCart = await cart.save();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_CLEARED, { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to clear cart", { error: err.message });
        }
    }
};

export default CartController;
