import mongoose from "mongoose";
import { Cart, Product } from "../models/index.js";
import { validateCartProducts } from "../utils/index.js";

const CART_CONSTANTS = {
  DEFAULT_QUANTITY: 1,
  SORT_DEFAULT: "createdAt",
  ORDER_ASCENDING: 1,
  ORDER_DESCENDING: -1,
  PRODUCTS_VALIDATION_RULES: {
    PRODUCT_ID_REQUIRED: true,
    QUANTITY_MIN_VALUE: 0,
    MAX_PRODUCTS_IN_CART: 50,
  },
  CART_TIMEOUT_MINUTES: 30,
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
  CART_EXPIRED: "Cart has expired and been cleared",
};

export class CartService {
  /**
   * Retrieves all carts with pagination and sorting.
   * @param {Object} options - Query options (page, limit, sort, order).
   * @returns {Object} Carts and pagination data.
   * @throws {Error} If query fails.
   */
  static async getCarts({ page, limit, sort = CART_CONSTANTS.SORT_DEFAULT, order = "asc" }) {
    try {
      const skip = (page - 1) * limit;
      const sortOrder = order === "desc" ? CART_CONSTANTS.ORDER_DESCENDING : CART_CONSTANTS.ORDER_ASCENDING;

      const [totalItems, carts] = await Promise.all([
        Cart.countDocuments(),
        Cart.find()
          .populate("products.productId", "name price stock image")
          .sort({ [sort]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        carts,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    } catch (err) {
      throw new Error(`Failed to retrieve carts: ${err.message}`);
    }
  }

  /**
   * Retrieves a user's or guest's cart, checking for expiration.
   * @param {Object} options - Identifier (userId, guestId).
   * @returns {Object} Cart data.
   * @throws {Error} If cart not found, expired, or query fails.
   */
  static async getCart({ userId, guestId }) {
    if (!userId && !guestId) {
      throw new Error(ERROR_MESSAGES.IDENTIFIER_REQUIRED);
    }

    try {
      const query = userId ? { userId } : { guestId };
      let cart = await Cart.findOne(query);

      if (!cart) {
        throw new Error(ERROR_MESSAGES.CART_NOT_FOUND);
      }

      const now = new Date();
      const timeoutThreshold = new Date(now - CART_CONSTANTS.CART_TIMEOUT_MINUTES * 60 * 1000);
      if (cart.lastUpdated < timeoutThreshold) {
        await this.clearExpiredCart(cart._id);
        throw new Error(ERROR_MESSAGES.CART_EXPIRED);
      }

      cart = await Cart.findOne(query)
        .populate("products.productId", "name price stock image")
        .lean();

      return cart;
    } catch (err) {
      throw new Error(err.message === ERROR_MESSAGES.CART_NOT_FOUND || err.message === ERROR_MESSAGES.CART_EXPIRED ? err.message : `Failed to retrieve cart: ${err.message}`);
    }
  }

  /**
   * Retrieves a cart by its ID.
   * @param {string} id - Cart ID.
   * @returns {Object} Cart data.
   * @throws {Error} If cart not found or query fails.
   */
  static async getCartById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid cart ID");
    }

    try {
      const cart = await Cart.findById(id)
        .populate("products.productId", "name price stock image")
        .lean();

      if (!cart) {
        throw new Error(ERROR_MESSAGES.CART_NOT_FOUND);
      }

      return cart;
    } catch (err) {
      throw new Error(err.message === ERROR_MESSAGES.CART_NOT_FOUND ? err.message : `Failed to retrieve cart: ${err.message}`);
    }
  }

  /**
   * Creates a new cart for a user.
   * @param {Object} options - Cart data (userId, guestId, products).
   * @returns {Object} Created cart.
   * @throws {Error} If validation fails, cart exists, or transaction fails.
   */
  static async createCart({ userId, guestId, products }) {
    if (!userId && !guestId) {
      throw new Error(ERROR_MESSAGES.IDENTIFIER_REQUIRED);
    }
    if (!products || !Array.isArray(products)) {
      throw new Error(ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const validationResult = validateCartProducts(products);
      if (!validationResult.valid) {
        throw new Error(validationResult.message);
      }

      const query = userId ? { userId } : { guestId };
      const existingCart = await Cart.findOne(query).session(session);
      if (existingCart) {
        throw new Error(ERROR_MESSAGES.CART_ALREADY_EXISTS);
      }

      const cartProducts = products.map((product) => ({
        productId: new mongoose.Types.ObjectId(product.productId),
        quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY,
      }));

      for (const item of cartProducts) {
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
        userId,
        guestId: userId ? undefined : guestId,
        products: cartProducts,
        lastUpdated: new Date(),
        version: 0,
      });
      const savedCart = await newCart.save({ session });

      await session.commitTransaction();
      const populatedCart = await Cart.findById(savedCart._id)
        .populate("products.productId", "name price stock image")
        .lean();

      return populatedCart;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates an existing cart's products.
   * @param {Object} options - Cart data (cartId, userId, products).
   * @returns {Object} Updated cart.
   * @throws {Error} If validation fails, cart not found, or transaction fails.
   */
  static async updateCart({ cartId, userId, products }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cart = await Cart.findById(cartId).session(session);
      if (!cart) {
        throw new Error(ERROR_MESSAGES.CART_NOT_FOUND);
      }
      if (cart.userId && cart.userId.toString() !== userId) {
        throw new Error("Not authorized to update this cart");
      }
      if (!products || !Array.isArray(products)) {
        throw new Error(ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY);
      }

      const validationResult = validateCartProducts(products);
      if (!validationResult.valid) {
        throw new Error(validationResult.message);
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

      const newProducts = products.map((product) => ({
        productId: new mongoose.Types.ObjectId(product.productId),
        quantity: product.quantity || CART_CONSTANTS.DEFAULT_QUANTITY,
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
        { _id: cartId, version: currentVersion },
        { products: newProducts, lastUpdated: new Date(), $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedCart) {
        throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
      }

      await session.commitTransaction();
      const populatedCart = await Cart.findById(updatedCart._id)
        .populate("products.productId", "name price stock image")
        .lean();

      return populatedCart;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Adds a product to a cart or creates a new cart if none exists.
   * @param {Object} options - Cart data (userId, guestId, productId, quantity).
   * @returns {Object} Updated or created cart.
   * @throws {Error} If validation fails, product not found, or transaction fails.
   */
  static async addToCart({ userId, guestId, productId, quantity = CART_CONSTANTS.DEFAULT_QUANTITY }) {
    if (!userId && !guestId) {
      throw new Error(ERROR_MESSAGES.IDENTIFIER_REQUIRED);
    }
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error(ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const validationResult = validateCartProducts([{ productId, quantity }]);
      if (!validationResult.valid) {
        throw new Error(validationResult.message);
      }

      const query = userId ? { userId } : { guestId };
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
          userId,
          guestId: userId ? undefined : guestId,
          products: [{ productId: new mongoose.Types.ObjectId(productId), quantity }],
          lastUpdated: new Date(),
          version: 0,
        });
        await updatedCart.save({ session });
      } else {
        const productIndex = cart.products.findIndex((p) => p.productId.toString() === productId);
        if (productIndex > -1) {
          cart.products[productIndex].quantity += quantity;
        } else {
          cart.products.push({ productId: new mongoose.Types.ObjectId(productId), quantity });
        }
        cart.lastUpdated = new Date();
        cart.markModified("products");
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
        .populate("products.productId", "name price stock image")
        .lean();

      return populatedCart;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Removes a product from a cart.
   * @param {Object} options - Cart data (userId, guestId, productId).
   * @returns {Object} Updated cart.
   * @throws {Error} If validation fails, cart not found, or transaction fails.
   */
  static async removeFromCart({ userId, guestId, productId }) {
    if (!userId && !guestId) {
      throw new Error(ERROR_MESSAGES.IDENTIFIER_REQUIRED);
    }
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error(ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const query = userId ? { userId } : { guestId };
      const cart = await Cart.findOne(query).session(session);
      if (!cart) {
        throw new Error(ERROR_MESSAGES.CART_NOT_FOUND);
      }

      const currentVersion = cart.version;
      const productIndex = cart.products.findIndex((p) => p.productId.toString() === productId);
      if (productIndex === -1) {
        throw new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND_IN_CART);
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
        .populate("products.productId", "name price stock image")
        .lean();

      return populatedCart;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Clears all products from a cart.
   * @param {Object} options - Cart data (userId, guestId).
   * @returns {Object} Cleared cart.
   * @throws {Error} If cart not found or transaction fails.
   */
  static async clearCart({ userId, guestId }) {
    if (!userId && !guestId) {
      throw new Error(ERROR_MESSAGES.IDENTIFIER_REQUIRED);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const query = userId ? { userId } : { guestId };
      const cart = await Cart.findOne(query).session(session);
      if (!cart) {
        throw new Error(ERROR_MESSAGES.CART_NOT_FOUND);
      }

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
        .populate("products.productId", "name price stock image")
        .lean();

      return populatedCart;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Clears an expired cart and restores product stock.
   * @param {string} cartId - Cart ID.
   * @throws {Error} If transaction fails.
   */
  static async clearExpiredCart(cartId) {
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
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }
}
