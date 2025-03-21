import HttpStatus from 'http-status-codes';
import Cart from "../models/_cart.js";
import { responseHandler } from '../utils/index.js';

const CartController = {
    // Get all carts (admin only) with pagination
    get_carts: async (req, res) => {
        try {
            if (!req.user.isAdmin) {
                return responseHandler(res, HttpStatus.FORBIDDEN, "error", "Admin access required");
            }

            const { page, limit } = res.locals.pagination;
            const skip = (page - 1) * limit;

            // Optional sorting parameters
            const sort = req.query.sort || 'createdAt';
            const order = req.query.order === 'desc' ? -1 : 1;

            // Parallel execution for count and data
            const [totalItems, carts] = await Promise.all([
                Cart.countDocuments(),
                Cart.find()
                    .sort({ [sort]: order })
                    .skip(skip)
                    .limit(limit)
            ]);

            // Set pagination metadata
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

            responseHandler(res, HttpStatus.OK, "success", "Carts retrieved successfully", responseData);
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve carts", { error: err.message });
        }
    },

    // Get the authenticated user's cart (no pagination needed)
    get_cart: async (req, res) => {
        try {
            const cart = await Cart.findOne({ userId: req.user.id });
            
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Cart not found");
            }
            
            responseHandler(res, HttpStatus.OK, "success", "Cart retrieved successfully", { cart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve cart", { error: err.message });
        }
    },

    // Create a new cart (no pagination needed)
    create_cart: async (req, res) => {
        try {
            if (!req.body.products || !Array.isArray(req.body.products)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Valid products array is required");
            }

            const existingCart = await Cart.findOne({ userId: req.user.id });
            if (existingCart) {
                return responseHandler(res, HttpStatus.CONFLICT, "error", "Cart already exists for this user");
            }

            const validProducts = req.body.products.every(product => 
                product.productId && 
                typeof product.productId === 'string' &&
                (!product.quantity || (typeof product.quantity === 'number' && product.quantity > 0))
            );
            if (!validProducts) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid product format in cart");
            }

            const newCart = new Cart({
                userId: req.user.id,
                products: req.body.products,
            });

            const savedCart = await newCart.save();
            responseHandler(res, HttpStatus.CREATED, "success", "Cart created successfully", { cart: savedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to create cart", { error: err.message });
        }
    },

    // Update a cart (no pagination needed)
    update_cart: async (req, res) => {
        try {
            const cart = await Cart.findById(req.params.id);
            
            if (!cart || cart.userId.toString() !== req.user.id) { // Convert to string for comparison
                return responseHandler(res, HttpStatus.FORBIDDEN, "error", "Not authorized to update this cart");
            }

            if (req.body.products) {
                if (!Array.isArray(req.body.products)) {
                    return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Products must be an array");
                }
                
                const validProducts = req.body.products.every(product => 
                    product.productId && 
                    typeof product.productId === 'string' &&
                    (!product.quantity || (typeof product.quantity === 'number' && product.quantity >= 0))
                );
                if (!validProducts) {
                    return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid product format");
                }
            }

            const updatedCart = await Cart.findByIdAndUpdate(
                req.params.id,
                { $set: req.body },
                { new: true, runValidators: true }
            );

            if (!updatedCart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Cart not found");
            }

            responseHandler(res, HttpStatus.OK, "success", "Cart updated successfully", { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to update cart", { error: err.message });
        }
    },

    // Add item to cart (no pagination needed)
    add_to_cart: async (req, res) => {
        try {
            const { productId, quantity = 1 } = req.body;
            
            if (!productId || typeof productId !== 'string') {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Valid productId (string) is required");
            }
            if (typeof quantity !== 'number' || quantity <= 0) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Valid quantity (positive number) is required");
            }

            let cart = await Cart.findOne({ userId: req.user.id });
            if (!cart) {
                cart = new Cart({ 
                    userId: req.user.id, 
                    products: [] 
                });
            }

            const productIndex = cart.products.findIndex(p => p.productId === productId);
            if (productIndex > -1) {
                cart.products[productIndex].quantity += quantity;
            } else {
                cart.products.push({ productId, quantity });
            }

            const updatedCart = await cart.save();
            responseHandler(res, HttpStatus.OK, "success", "Item added to cart", { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to add item to cart", { error: err.message });
        }
    },

    // Remove item from cart (no pagination needed)
    remove_from_cart: async (req, res) => {
        try {
            const { productId } = req.body;
            
            if (!productId || typeof productId !== 'string') {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Valid productId (string) is required");
            }

            const cart = await Cart.findOne({ userId: req.user.id });
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Cart not found");
            }

            const productIndex = cart.products.findIndex(p => p.productId === productId);
            if (productIndex === -1) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Product not found in cart");
            }

            cart.products.splice(productIndex, 1);
            const updatedCart = await cart.save();
            responseHandler(res, HttpStatus.OK, "success", "Item removed from cart", { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to remove item from cart", { error: err.message });
        }
    },

    // Clear all items from cart (no pagination needed)
    clear_cart: async (req, res) => {
        try {
            const cart = await Cart.findOne({ userId: req.user.id });
            
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Cart not found");
            }

            cart.products = [];
            const updatedCart = await cart.save();
            
            responseHandler(res, HttpStatus.OK, "success", "Cart cleared successfully", { cart: updatedCart });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to clear cart", { error: err.message });
        }
    }
};

export default CartController;
