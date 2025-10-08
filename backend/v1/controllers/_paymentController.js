import HttpStatus from "http-status-codes";
import { PaymentService } from "../services/_paymentService.js";
import { responseHandler } from "../utils/index.js";

const SUCCESS_MESSAGES = {
  PAYMENT_PROCESSED: "Payment initialized successfully, proceed to authorization",
};

const ERROR_MESSAGES = {
  NO_ORDERS: "No pending orders found for this user.",
  PAYMENT_FAILED: "Payment initialization failed",
  PROCESSING_FAILED: "Payment processing failed",
  SERVER_ERROR: "Something went wrong, please try again",
};

export class PaymentController {
  /**
   * Initializes a payment for a user's pending order.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async createPayment(req, res) {
    try {
      const { email, currency } = req.body;
      const { order, paystack, shipment } = await PaymentService.createPayment({
        userId: req.user.id,
        email,
        currency,
      });

      responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGES.PAYMENT_PROCESSED, {
        order,
        paystack,
        shipment,
      });
    } catch (err) {
      const status =
        err.message === ERROR_MESSAGES.NO_ORDERS
          ? HttpStatus.NOT_FOUND
          : err.message === ERROR_MESSAGES.PAYMENT_FAILED
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, "error", err.message, { error: err.message });
    }
  }
}

export default PaymentController;
