import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import { Cart, Product } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

const CART_CONSTANTS = {
    DEFAULT_QUANTITY: 1,
    SORT_DEFAULT: 'createdAt',
    ORDER_ASCENDING: 1,
    ORDER_DESCENDING: -1,
    PRODUCTS_VALIDATION_RULES: {
        PRODUCT_ID_REQUIRED: true,
        QUANTITY_MIN_VALUE: 0
    },
    CART_TIMEOUT_MINUTES: 30 // Added for expiration
};

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
                    .populate('products.productId', 'name price stock image')
                    .sort({ [sort]: order })
                    .skip(skip)
                    .limit(limit)
                    .lean()
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
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { guestId } = req.body;
            const identifier = req.user?.id || (req.user?.guestId ? req.user.guestId : guestId);

            if (!identifier) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.IDENTIFIER_REQUIRED);
            }

            const query = req.user?.id ? { userId: req.user.id } : { guestId: identifier };
            let cart = await Cart.findOne(query).session(session);

            if (!cart) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_NOT_FOUND);
            }

            const now = new Date();
            const timeoutThreshold = new Date(now - CART_CONSTANTS.CART_TIMEOUT_MINUTES * 60 * 1000);
            if (cart.lastUpdated < timeoutThreshold) {
                await CartController.clearExpiredCart(cart._id);
                await session.commitTransaction();
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.CART_EXPIRED);
            }

            await session.commitTransaction();
            cart = await Cart.findOne(query)
                .populate('products.productId', 'name price stock image')
                .lean();

            responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_CREATED, { cart });
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to retrieve cart", { error: err.message });
        } finally {
            session.endSession();
        }
    },

    get_cart_by_id: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid cart ID");
            }

            const cart = await Cart.findById(id)
                .populate('products.productId', 'name price stock image')
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

    create_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            if (!req.body.products || !Array.isArray(req.body.products)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
            }

            const existingCart = await Cart.findOne({ userId: req.user.id }).session(session);
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

            const products = req.body.products.map(product => ({
                productId: new mongoose.Types.ObjectId(product.productId),
                quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY
            }));

            for (const item of products) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: -item.quantity, version: 1 } },
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
                lastUpdated: new Date(),
                version: 0
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

                const currentVersion = cart.version;
                for (const item of cart.products) {
                    const product = await Product.findOneAndUpdate(
                        { _id: item.productId, version: { $gte: 0 } },
                        { $inc: { stock: item.quantity, version: 1 } },
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
                        { $inc: { stock: -item.quantity, version: 1 } },
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
                    { products: newProducts, lastUpdated: new Date(), $inc: { version: 1 } },
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
            } else {
                await session.abortTransaction();
                responseHandler(res, HttpStatus.BAD_REQUEST, "error", "No products provided to update");
            }
        } catch (err) {
            await session.abortTransaction();
            responseHandler(res, err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
        } finally {
            session.endSession();
        }
    },

    add_to_cart: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { productId, quantity = CART_CONSTANTS.DEFAULT_QUANTITY, guestId } = req.body;
            const identifier = req.user?.id || (req.user?.guestId ? req.user.guestId : guestId);

            if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED);
            }

            if (typeof quantity !== 'number' || quantity <= CART_CONSTANTS.PRODUCTS_VALIDATION_RULES.QUANTITY_MIN_VALUE) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_QUANTITY);
            }

            if (!identifier) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.IDENTIFIER_REQUIRED);
            }

            const query = req.user?.id ? { userId: req.user.id } : { guestId: identifier };
            const cart = await Cart.findOne(query).session(session);
            const currentVersion = cart ? cart.version : 0;

            const product = await Product.findOneAndUpdate(
                { _id: productId, version: { $gte: 0 } },
                { $inc: { stock: -quantity, version: 1 } },
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
                    guestId: req.user ? undefined : identifier,
                    products: [{ productId: new mongoose.Types.ObjectId(productId), quantity }],
                    lastUpdated: new Date(),
                    version: 0
                });
                await updatedCart.save({ session });
            } else {
                const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
                if (productIndex > -1) {
                    cart.products[productIndex].quantity += quantity;
                } else {
                    cart.products.push({ productId: new mongoose.Types.ObjectId(productId), quantity });
                }
                cart.lastUpdated = new Date();
                cart.markModified('products');
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
                { $inc: { stock: quantityToRestore, version: 1 } },
                { new: true, session }
            );
            if (!product) {
                throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${productId}`);
            }

            cart.products.splice(productIndex, 1);
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
                    { $inc: { stock: item.quantity, version: 1 } },
                    { new: true, session }
                );
                if (!product) {
                    throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${item.productId}`);
                }
            }

            const updatedCart = await Cart.findOneAndUpdate(
                { _id: cart._id, version: currentVersion },
                { products: [], lastUpdated: new Date(), $inc: { version: 1 } },
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

    clearExpiredCart: async (cartId) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const cart = await Cart.findById(cartId).session(session);
            if (!cart) return;

            const currentVersion = cart.version;
            for (const item of cart.products) {
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, version: { $gte: 0 } },
                    { $inc: { stock: item.quantity, version: 1 } },
                    { new: true, session }
                );
                if (!product) {
                    console.warn(`Product ${item.productId} not found during cart cleanup`);
                }
            }

            const deletedCart = await Cart.findOneAndDelete(
                { _id: cartId, version: currentVersion },
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
