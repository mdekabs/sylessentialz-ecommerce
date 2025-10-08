import HttpStatus from "http-status-codes";
import { AuthService } from "../services/_authService.js";
import { responseHandler } from "../utils/index.js";

export class AuthController {
  /**
   * Registers a new user.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async createUser(req, res) {
    try {
      const user = await AuthService.createUser(req.body);
      responseHandler(res, HttpStatus.CREATED, "success", "User has been created successfully", { user });
    } catch (err) {
      responseHandler(res, err.message.includes("required") ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT, "error", err.message);
    }
  }

  /**
   * Logs in a user and returns a JWT token.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async loginUser(req, res) {
    try {
      const data = await AuthService.loginUser(req.body);
      responseHandler(res, HttpStatus.OK, "success", "Successfully logged in", data);
    } catch (err) {
      const status = err.message.includes("required") ? HttpStatus.BAD_REQUEST : err.message.includes("locked") ? HttpStatus.FORBIDDEN : HttpStatus.UNAUTHORIZED;
      responseHandler(res, status, "error", err.message);
    }
  }

  /**
   * Logs out a user.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async logoutUser(req, res) {
    try {
      const token = req.header("Authorization");
      await AuthService.logoutUser(token);
      responseHandler(res, HttpStatus.OK, "success", "Successfully logged out.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
    }
  }

  /**
   * Initiates a password reset process.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async forgotPassword(req, res) {
    try {
      await AuthService.forgotPassword(req.body.email);
      responseHandler(res, HttpStatus.OK, "success", "Password reset email sent.");
    } catch (err) {
      responseHandler(res, err.message.includes("not found") ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
    }
  }

  /**
   * Resets a user's password.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async resetPassword(req, res) {
    try {
      await AuthService.resetPassword(req.body);
      responseHandler(res, HttpStatus.OK, "success", "Password reset successful.");
    } catch (err) {
      responseHandler(res, err.message.includes("token") ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
    }
  }

  /**
   * Generates a guest ID and token.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async generateGuestId(req, res) {
    try {
      const data = await AuthService.generateGuestId();
      responseHandler(res, HttpStatus.OK, "success", "Guest ID and token generated successfully", data);
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", err.message);
    }
  }
}

export default AuthController;
