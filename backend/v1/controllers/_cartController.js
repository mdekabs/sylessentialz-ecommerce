import HttpStatus from "http-status-codes";
import { CartService } from "../services/_cartService.js";
import { responseHandler } from "../utils/index.js";

const SUCCESS_MESSAGES = {
  CARTS_RETRIEVED: "Carts retrieved successfully",
  CART_CREATED: "Cart created successfully",
  CART_UPDATED: "Cart updated successfully",
  ITEM_ADDED: "Item added to cart",
  ITEM_REMOVED: "Item removed from cart",
  CART_CLEARED: "Cart cleared successfully",
  CART_RETRIEVED: "Cart retrieved successfully",
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

export class CartController {
  /**
   * Retrieves all carts with pagination and sorting.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getCarts(req, res) {
    try {
      const { page, limit, hasMorePages, links } = res.locals.pagination;
      const { sort, order } = req.query;

      const { carts, pagination } = await CartService.getCarts({ page, limit, sort, order });

      res.locals.setPagination(pagination.totalItems);

      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CARTS_RETRIEVED, {
        carts,
        pagination: {
          ...pagination,
          hasMorePages,
          links,
        },
      });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", `Failed to retrieve carts: ${err.message}`, { error: err.message });
    }
  }

  /**
   * Retrieves a user's or guest's cart.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getCart(req, res) {
    try {
      const { guestId } = req.body;
      const identifier = req.user?.id || req.user?.guestId || guestId;

      const cart = await CartService.getCart({ userId: req.user?.id, guestId: identifier });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_RETRIEVED, { cart });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.CART_NOT_FOUND || err.message === ERROR_MESSAGES.CART_EXPIRED
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.IDENTIFIER_REQUIRED
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Retrieves a cart by its ID.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getCartById(req, res) {
    try {
      const cart = await CartService.getCartById(req.params.id);
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_RETRIEVED, { cart });
    } catch (err) {
      const status = err.message === ERROR_MESSAGES.CART_NOT_FOUND ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Creates a new cart for a user.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async createCart(req, res) {
    try {
      const cart = await CartService.createCart({
        userId: req.user?.id,
        guestId: req.body.guestId,
        products: req.body.products,
      });
      responseHandler(res, HttpStatus.CREATED, "success", SUCCESS_MESSAGES.CART_CREATED, { cart });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY ||
        err.message === ERROR_MESSAGES.IDENTIFIER_REQUIRED ||
        err.message.includes(ERROR_MESSAGES.INVALID_PRODUCT_FORMAT) ||
        err.message.includes(ERROR_MESSAGES.INVALID_QUANTITY)
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.CART_ALREADY_EXISTS
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Updates an existing cart's products.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async updateCart(req, res) {
    try {
      const cart = await CartService.updateCart({
        cartId: req.params.id,
        userId: req.user?.id,
        products: req.body.products,
      });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_UPDATED, { cart });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.CART_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : err.message === ERROR_MESSAGES.INVALID_PRODUCTS_ARRAY ||
            err.message.includes(ERROR_MESSAGES.INVALID_PRODUCT_FORMAT) ||
            err.message.includes(ERROR_MESSAGES.INVALID_QUANTITY)
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Adds a product to a cart or creates a new cart.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async addToCart(req, res) {
    try {
      const { productId, quantity, guestId } = req.body;
      const cart = await CartService.addToCart({
        userId: req.user?.id,
        guestId: req.user?.guestId || guestId,
        productId,
        quantity,
      });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ITEM_ADDED, { cart });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.IDENTIFIER_REQUIRED ||
        err.message === ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED ||
        err.message.includes(ERROR_MESSAGES.INVALID_QUANTITY)
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Removes a product from a cart.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async removeFromCart(req, res) {
    try {
      const { productId, guestId } = req.body;
      const cart = await CartService.removeFromCart({
        userId: req.user?.id,
        guestId: req.user?.guestId || guestId,
        productId,
      });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ITEM_REMOVED, { cart });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.CART_NOT_FOUND || err.message === ERROR_MESSAGES.PRODUCT_NOT_FOUND_IN_CART
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.VALID_PRODUCT_ID_REQUIRED || err.message === ERROR_MESSAGES.IDENTIFIER_REQUIRED
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Clears all products from a cart.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async clearCart(req, res) {
    try {
      const { guestId } = req.body;
      const cart = await CartService.clearCart({
        userId: req.user?.id,
        guestId: req.user?.guestId || guestId,
      });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.CART_CLEARED, { cart });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.CART_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.IDENTIFIER_REQUIRED
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }
}

export default CartController;
