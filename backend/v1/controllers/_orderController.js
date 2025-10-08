import HttpStatus from "http-status-codes";
import { OrderService } from "../services/_orderService.js";
import { responseHandler } from "../utils/index.js";

const SUCCESS_MESSAGES = {
  ORDER_CREATED: "Order placed successfully",
  ORDERS_RETRIEVED: "Orders retrieved successfully",
  STATUS_UPDATED: "Order status updated successfully",
  ORDER_CANCELLED: "Order cancelled and store credit issued.",
  INCOME_CALCULATED: "Total income calculated successfully",
  STORE_CREDIT_RETRIEVED: "Store credit retrieved successfully",
  NO_STORE_CREDIT: "No active store credit available.",
};

const ERROR_MESSAGES = {
  ADDRESS_REQUIRED: "Address is required.",
  CART_EMPTY: "Your cart is empty.",
  CART_EXPIRED: "Cart has expired and been cleared.",
  PRODUCT_NOT_FOUND: "Product not found",
  ORDER_NOT_FOUND: "Order not found.",
  INVALID_STATUS: "Invalid status provided.",
  ALREADY_CANCELLED: "Order is already cancelled.",
  CONCURRENCY_CONFLICT: "Order or cart was modified by another request. Please retry.",
  SERVER_ERROR: "Something went wrong, please try again",
};

export class OrderController {
  /**
   * Creates a new order from the user's cart.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async createOrder(req, res) {
    try {
      const { order, creditApplied } = await OrderService.createOrder({
        userId: req.user.id,
        address: req.body.address,
      });
      responseHandler(res, HttpStatus.CREATED, "success", SUCCESS_MESSAGES.ORDER_CREATED, {
        order,
        creditApplied,
      });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.ADDRESS_REQUIRED || err.message === ERROR_MESSAGES.CART_EMPTY
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.CART_EXPIRED
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Retrieves all orders with pagination.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getAllOrders(req, res) {
    try {
      const { page, limit, hasMorePages, links } = res.locals.pagination;
      const { orders, pagination } = await OrderService.getAllOrders({ page, limit });

      res.locals.setPagination(pagination.totalItems);

      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ORDERS_RETRIEVED, {
        orders,
        pagination: {
          ...pagination,
          hasMorePages,
          links,
        },
      });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.SERVER_ERROR, {
        error: err.message,
      });
    }
  }

  /**
   * Retrieves orders for the authenticated user.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getUserOrders(req, res) {
    try {
      const { page, limit, hasMorePages, links } = res.locals.pagination;
      const { orders, pagination } = await OrderService.getUserOrders({
        userId: req.user.id,
        page,
        limit,
      });

      res.locals.setPagination(pagination.totalItems);

      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ORDERS_RETRIEVED, {
        orders,
        pagination: {
          ...pagination,
          hasMorePages,
          links,
        },
      });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.SERVER_ERROR, {
        error: err.message,
      });
    }
  }

  /**
   * Updates the status of an order.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async updateOrderStatus(req, res) {
    try {
      const updatedOrder = await OrderService.updateOrderStatus({
        orderId: req.params.orderId,
        status: req.body.status,
      });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.STATUS_UPDATED, { order: updatedOrder });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.INVALID_STATUS
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.ORDER_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Cancels an order and issues store credit.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async cancelOrderAndIssueStoreCredit(req, res) {
    try {
      const { orderId, storeCredit } = await OrderService.cancelOrderAndIssueStoreCredit({
        orderId: req.params.orderId,
      });
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.ORDER_CANCELLED, { orderId, storeCredit });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.ORDER_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.ALREADY_CANCELLED
          ? HttpStatus.BAD_REQUEST
          : err.message === ERROR_MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }

  /**
   * Calculates total income from orders and store credit.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getIncome(req, res) {
    try {
      const incomeData = await OrderService.getIncome();
      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.INCOME_CALCULATED, incomeData);
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.SERVER_ERROR, {
        error: err.message,
      });
    }
  }

  /**
   * Retrieves the user's store credit.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getStoreCredit(req, res) {
    try {
      const storeCredit = await OrderService.getStoreCredit(req.user.id);
      const message = storeCredit.amount === 0 ? SUCCESS_MESSAGES.NO_STORE_CREDIT : SUCCESS_MESSAGES.STORE_CREDIT_RETRIEVED;
      responseHandler(res, HttpStatus.OK, "success", message, { storeCredit });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.SERVER_ERROR, {
        error: err.message,
      });
    }
  }
}

export default OrderController;
