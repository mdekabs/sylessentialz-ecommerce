import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import { Cart, Product } from "../models/index.js";
import { responseHandler, validateCartProducts } from '../utils/index.js';

/**
 * Constants for cart operations.
 */
const CART_CONSTANTS = {
    DEFAULT_QUANTITY: 1,                        // Default quantity for items
    SORT_DEFAULT: 'createdAt',                  // Default sort field
    ORDER_ASCENDING: 1,                         // Ascending sort order
    ORDER_DESCENDING: -1,                       // Descending sort order
    PRODUCTS_VALIDATION_RULES: {
        PRODUCT_ID_REQUIRED: true,              // Product ID is mandatory
        QUANTITY_MIN_VALUE: 0,                  // Minimum quantity allowed
        MAX_PRODUCTS_IN_CART: 50                // Maximum quantity allowed
    },
    CART_TIMEOUT_MINUTES: 30                    // Cart expiration time in minutes
};

/**
 * Error messages for cart operations.
 */
const ERROR_MESSAGES = {
    CART_NOT_FOUND: "Cart not found",
    INVALID_PRODUCTS_ARRAY: "Valid products array is required",
    CART_ALREADY_EXISTS: "Cart already exists for this user",
    INVALID_PRODUCT_FORMAT: "Invalid product format",
    INVALID_QUANTITY: "Valid quantity (positive number) is required",
    PRODUCT_NOT_FOUND_IN_CART: "Product not found in cart",
    VALID_PRODUCT_ID_REQUIRED: "Valid productId (ObjectId) is required",
    IDENTIFIER_REQUIRED: "User ID or Guest ID required",
    INSUFFICIENT_STOCK: "Insufficient stock for product",
    PRODUCT_NOT_FOUND: "Product not found",
    CONCURRENCY_CONFLICT: "Cart or product was modified by another request. Please retry.",
    CART_EXPIRED: "Cart has expired and been cleared"
};

/**
 * Success messages for cart operations.
 */
const SUCCESS_MESSAGES = {
    CARTS_RETRIEVED: "Carts retrieved successfully",
    CART_CREATED: "Cart created successfully",
    CART_UPDATED: "Cart updated successfully",
    ITEM_ADDED: "Item added to cart",
    ITEM_REMOVED: "Item removed from cart",
    CART_CLEARED: "Cart cleared successfully"
};

/**
 * Controller for managing shopping cart operations.
 */
const CartController = {
    /**
     * Retrieves all carts with pagination and sorting.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    get_carts: async (req, res) => {
        try {
            const { page, limit } = res.locals.pagination; // From pagination middleware
            const skip = (page - 1) * limit;               // Calculate skip value

            const sort = req.query.sort || CART_CONSTANTS.SORT_DEFAULT; // Default sort field
            const order = req.query.order === 'desc' ? CART_CONSTANTS.ORDER_DESCENDING : CART_CONSTANTS.ORDER_ASCENDING; // Sort direction

            const [totalItems, carts] = await Promise.all([
                Cart.countDocuments(),                     // Total cart count
                Cart.find()
                    .populate('products.productId', 'name price stock image') // Populate product details
                    .sort({ [sort]: order })              // Apply sorting
                    .skip(skip)                            // Pagination skip
                    .limit(limit)                          // Pagination limit
                    .lean()                                // Return plain JS objects
            ]);

            res.locals.setPagination(totalItems);          // Set pagination metadata

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

    /**
     * Retrieves a user's or guest's cart, checking for expiration.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    get_cart: async (req, res) => {
        const session = awaited mongoose.startSession();
        session.startTransaction();
        try {
            const { guestId } = req.body;
            const identifier = req.user?.id || (req.user?.guestId ? req.user.guestId : guestId); // User or guest ID

            if (!identifier) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.IDENTIFIER_REQUIRED);
            }

            const query = req.user?.id ? { userId: req.user.id } : { guestId: identifier }; // Query based on identifier
            let cart = await Cart.findOne(query).session(session);

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            const now = new Date();
            const timeoutThreshold = new Date(now - CART_CONSTANTS.CART_TIMEOUT_MINUTES * 60 * 1000); // 30-min threshold
            if (cart.lastUpdated < timeoutThreshold) {
                await CartController.clearExpiredCart(cart._id); // Clear expired cart
                await session.commitTransaction();
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_EXPIRED);
            }

            await session.commitTransaction();
            cart = await Cart.findOne(query)
                .populate('products.productId', 'name price stock image') // Populate product details
                .lean();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_CREATED, { cart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve cart", { error: err.message });
        } finally {
            session.endSession();                          // Clean up session
        }
    },

    /**
     * Retrieves a cart by its ID.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    get_cart_by_id: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid cart ID");
            }

            const cart = await Cart.findById(id)
                .populate('products.productId', 'name price stock image') // Populate product details
                .lean();

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            responseHandler(res, HttpStatus.OK, "success", "Cart retrieved successfully", { cart });
        } catch (err) {
            console.error('Get cart by ID error:', err);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve cart", { error: err.message });
        }
    },

    /**
     * Creates a new cart for a user.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    create_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            if (!req.body.products || !Array.isArray(req.body.products)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
            }

            // Validate products using validateCartProducts
            const validationResult = validateCartProducts(req.body.products);
            if (!validationResult.valid) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", validationResult.message);
            }

            const existingCart = await Cart.findOne({ userId: req.user.id }).session(session);
            if (existingCart) {
                return responseHandler(res, HttpStatus.CONFLICT, "error", ERROR_MESSAGES.CART_ALREADY_EXISTS);
            }

            const products = req.body.products.map(product => ({
                productId: new mongoose.Types.ObjectId(product.productId),
                quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY // Default if not provided
            }));

            for (const item of products) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: -item.quantity, version: 1 } }, // Reduce stock, increment version
                    { new: true, session }
                );
                if (!product) {
                    throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${item.productId}`);
                }
                if (product.stock < 0) {
                    throw new Error(`${ERROR_MESSAGES.INSUFFICIENT_STOCK}: ${product.name}`);
                }
            }

            const newCart = new Cart({
                userId: req.user.id,
                products,
                lastUpdated: new Date(),           // Set creation time
                version: 0                         // Initial version
            });
            const savedCart = await newCart.save({ session });

            await session.commitTransaction();
            const populatedCart = await Cart.findById(savedCart._id)
                .populate('products.productId', 'name price stock image')
                .lean();

            responseHandler(res, HttpStatus.CREATED, "success", SUCCESS_MESSAGES.CART_CREATED, { cart: populatedCart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to create cart", { error: err.message });
        } finally {
            session.endSession();
        }
    },

    /**
     * Updates an existing cart's products.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    update_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const cart = await Cart.findById(req.params.id).session(session);
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            if (cart.userId.toString() !== req.user.id) {
                return responseHandler(res, HttpStatus.FORBIDDEN, "error", "Not authorized to update this cart");
            }

            if (!req.body.products || !Array.isArray(req.body.products)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
            }

            // Validate products using validateCartProducts
            const validationResult = validateCartProducts(req.body.products);
            if (!validationResult.valid) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", validationResult.message);
            }

            const currentVersion = cart.version;
            for (const item of cart.products) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: item.quantity, version: 1 } }, // Restore stock
                    { new: true, session }
                );
                if (!product) {
                    throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${item.productId}`);
                }
            }

            const newProducts = req.body.products.map(product => ({
                productId: new mongoose.Types.ObjectId(product.productId),
                quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY
            }));

            for (const item of newProducts) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: -item.quantity, version: 1 } }, // Reduce stock
                    { new: true, session }
                );
                if (!product) {
                    throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${item.productId}`);
                }
                if (product.stock < 0) {
                    throw new Error(`${ERROR_MESSAGES.INSUFFICIENT_STOCK}: ${product.name}`);
                }
            }

            const updatedCart = await Cart.findOneAndUpdate(
                { _id: req.params.id, version: currentVersion },
                { products: newProducts, lastUpdated: new Date(), $inc: { version: 1 } }, // Update with version check
                { new: true, session }
            );
            if (!updatedCart) {
                throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
            }

            await session.commitTransaction();
            const populatedCart = await Cart.findById(updatedCart._id)
                .populate('products.productId', 'name price stock image')
                .lean();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_UPDATED, { cart: populatedCart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
        } finally {
            session.endSession();
        }
    },

    /**
     * Adds a product to a cart or creates a new cart if none exists.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    add_to_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { productId, quantity = CART_CONSTANTS.DEFAULT_QUANTITY, guestId } = req.body;
            const identifier = req.user?.id || (req.user?.guestId ? req.user.guestId : guestId);

            if (!identifier) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.IDENTIFIER_REQUIRED);
            }

            // Validate single product using validateCartProducts
            const validationResult = validateCartProducts([{ productId, quantity }]);
            if (!validationResult.valid) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", validationResult.message);
            }

            const query = req.user?.id ? { userId: req.user.id } : { guestId: identifier };
            const cart = await Cart.findOne(query).session(session);
            const currentVersion = cart ? cart.version : 0;

            const product = await Product.findOneAndUpdate(
                { _id: productId, version: { $gte: 0 } },
                { $inc: { stock: -quantity, version: 1 } }, // Reduce stock
                { new: true, session }
            );
            if (!product) {
                throw new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
            }
            if (product.stock < 0) {
                throw new Error(`${ERROR_MESSAGES.INSUFFICIENT_STOCK}: ${product.name}`);
            }

            let updatedCart;
            if (!cart) {
                updatedCart = new Cart({
                    userId: req.user?.id,
                    guestId: req.user ? undefined : identifier, // Set guestId if no user
                    products: [{ productId: new mongoose.Types.ObjectId(productId), quantity }],
                    lastUpdated: new Date(),
                    version: 0
                });
                await updatedCart.save({ session });
            } else {
                const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
                if (productIndex > -1) {
                    cart.products[productIndex].quantity += quantity; // Update existing quantity
                } else {
                    cart.products.push({ productId: new mongoose.Types.ObjectId(productId), quantity });
                }
                cart.lastUpdated = new Date();
                cart.markModified('products');                    // Mark array as modified
                updatedCart = await Cart.findOneAndUpdate(
                    { _id: cart._id, version: currentVersion },
                    { products: cart.products, lastUpdated: new Date(), $inc: { version: 1 } },
                    { new: true, session }
                );
                if (!updatedCart) {
                    throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
                }
            }

            await session.commitTransaction();
            const populatedCart = await Cart.findById(updatedCart._id)
                .populate('products.productId', 'name price stock image')
                .lean();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ITEM_ADDED, { cart: populatedCart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
        } finally {
            session.endSession();
        }
    },

    /**
     * Removes a product from a cart.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    remove_from_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { productId, guestId } = req.body;
            const identifier = req.user?.id || (req.user?.guestId ? req.user.guestId : guestId);

            if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED);
            }

            if (!identifier) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.IDENTIFIER_REQUIRED);
            }

            const query = req.user?.id ? { userId: req.user.id } : { guestId: identifier };
            const cart = await Cart.findOne(query).session(session);
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            const currentVersion = cart.version;
            const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
            if (productIndex === -1) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.PRODUCT_NOT_FOUND_IN_CART);
            }

            const quantityToRestore = cart.products[productIndex].quantity;
            const product = await Product.findOneAndUpdate(
                { _id: productId, version: { $gte: 0 } },
                { $inc: { stock: quantityToRestore, version: 1 } }, // Restore stock
                { new: true, session }
            );
            if (!product) {
                throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${productId}`);
            }

            cart.products.splice(productIndex, 1); // Remove product from cart
            const updatedCart = await Cart.findOneAndUpdate(
                { _id: cart._id, version: currentVersion },
                { products: cart.products, lastUpdated: new Date(), $inc: { version: 1 } },
                { new: true, session }
            );
            if (!updatedCart) {
                throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
            }

            await session.commitTransaction();
            const populatedCart = await Cart.findById(updatedCart._id)
                .populate('products.productId', 'name price stock image')
                .lean();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ITEM_REMOVED, { cart: populatedCart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
        } finally {
            session.endSession();
        }
    },

    /**
     * Clears all products from a cart.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    clear_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { guestId } = req.body;
            const identifier = req.user?.id || (req.user?.guestId ? req.user.guestId : guestId);

            if (!identifier) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.IDENTIFIER_REQUIRED);
            }

            const query = req.user?.id ? { userId: req.user.id } : { guestId: identifier };
            const cart = await Cart.findOne(query).session(session);
            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            const currentVersion = cart.version;
            for (const item of cart.products) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: item.quantity, version: 1 } }, // Restore stock
                    { new: true, session }
                );
                if (!product) {
                    throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${item.productId}`);
                }
            }

            const updatedCart = await Cart.findOneAndUpdate(
                { _id: cart._id, version: currentVersion },
                { products: [], lastUpdated: new Date(), $inc: { version: 1 } }, // Clear products
                { new: true, session }
            );
            if (!updatedCart) {
                throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
            }

            await session.commitTransaction();
            const populatedCart = await Cart.findById(updatedCart._id)
                .populate('products.productId', 'name price stock image')
                .lean();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_CLEARED, { cart: populatedCart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
        } finally {
            session.endSession();
        }
    },

    /**
     * Clears an expired cart and restores product stock.
     * @param {string} cartId - The ID of the cart to clear
     * @returns {Promise<void>}
     * @throws {Error} If operation fails
     */
    clearExpiredCart: async (cartId) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const cart = await Cart.findById(cartId).session(session);
            if (!cart) return;                         // Exit if cart not found

            const currentVersion = cart.version;
            for (const item of cart.products) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: item.quantity, version: 1 } }, // Restore stock
                    { new: true, session }
                );
                if (!product) {
                    console.warn(`Product ${item.productId} not found during cart cleanup`);
                }
            }

            const deletedCart = await Cart.findOneAndDelete(
                { _id: cartId, version: currentVersion }, // Delete with version check
                { session }
            );
            if (!deletedCart) {
                throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
            }

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }
};

export default CartController;
