import HttpStatus from "http-status-codes";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { responseHandler, emailQueue, generatePasswordResetEmail } from "../utils/index.js";
import { updateBlacklist } from "../middlewares/index.js";

dotenv.config(); // Load environment variables

const JWT_SECRET = process.env.JWT_SECRET;          // Secret for JWT signing
const JWT_EXPIRATION = "1d";                        // JWT expiration: 1 day
const PASSWORD_RESET_EXPIRATION = 3600000;          // Reset token expiration: 1 hour (in ms)
const TOKEN_BYTES = 32;                             // Size of reset token in bytes
const GUEST_TOKEN_EXPIRATION = '1h';                // Guest token expiration: 1 hour

/**
 * Authentication controller for user management and session handling.
 */
const AuthController = {
  /**
   * Creates an admin user if it doesn't already exist.
   * Uses environment variables for admin credentials.
   * @returns {Promise<void>}
   */
  create_admin_user: async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;     // Admin email from env
      const adminUsername = process.env.ADMIN_USERNAME; // Admin username from env
      const adminPassword = process.env.ADMIN_PASSWORD; // Admin password from env

      const existingAdmin = await User.findOne({ email: adminEmail });
      if (existingAdmin) {
        console.log("ℹ️ Admin user already exists.");
        return;
      }

      const newAdmin = new User({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        isAdmin: true,                        // Set as admin
      });

      await newAdmin.save();
      console.log("✅ Admin user created successfully!");
    } catch (err) {
      console.error("❌ Failed to create admin user:", err.message);
    }
  },

  /**
   * Registers a new user.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  create_user: async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Username, email, and password are required.");
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return responseHandler(res, HttpStatus.CONFLICT, "error", "Email is already in use.");
      }

      const newUser = new User({ username, email, password });
      const user = await newUser.save();

      responseHandler(res, HttpStatus.CREATED, "success", "User has been created successfully", { user });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "User creation failed: " + err.message);
    }
  },

  /**
   * Logs in a user and issues a JWT token.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  login_user: async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Username and password are required.");
      }

      const user = await User.findOne({ username });
      if (!user) {
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", "Invalid username or password.");
      }

      if (!user.canLogin()) {
        return responseHandler(res, HttpStatus.FORBIDDEN, "error", `Account locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}`);
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incrementLoginAttempts(); // Increment failed attempts
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", "Incorrect password.");
      }

      await user.resetLoginAttempts();       // Reset attempts on success

      const accessToken = jwt.sign({ id: user._id.toString(), isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
      const { password: _, ...data } = user._doc; // Exclude password from response

      responseHandler(res, HttpStatus.OK, "success", "Successfully logged in", { ...data, accessToken });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Login failed: " + err.message);
    }
  },

  /**
   * Logs out a user by blacklisting their token.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  logout_user: async (req, res) => {
    try {
      const token = req.header("Authorization"); // Get token from header
      await updateBlacklist(token);              // Blacklist token
      responseHandler(res, HttpStatus.OK, "success", "Successfully logged out.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Logout failed: " + err.message);
    }
  },

  /**
   * Initiates a password reset process by sending an email.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  forgot_password: async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return responseHandler(res, HttpStatus.NOT_FOUND, "error", "User not found.");
      }

      const resetToken = crypto.randomBytes(TOKEN_BYTES).toString("hex"); // Generate secure token
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + PASSWORD_RESET_EXPIRATION; // Set expiration
      await user.save();

      await emailQueue.add("sendEmail", generatePasswordResetEmail(user.email, resetToken)); // Queue email
      responseHandler(res, HttpStatus.OK, "success", "Password reset email sent.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Forgot password failed: " + err.message);
    }
  },

  /**
   * Resets a user's password using a valid token.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  reset_password: async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const user = await User.findOne({ 
        resetPasswordToken: token, 
        resetPasswordExpires: { $gt: Date.now() } // Check token validity
      });
      if (!user) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid or expired token.");
      }

      user.password = newPassword;
      user.resetPasswordToken = undefined;   // Clear token
      user.resetPasswordExpires = undefined; // Clear expiration
      await user.save();

      responseHandler(res, HttpStatus.OK, "success", "Password reset successful.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Password reset failed: " + err.message);
    }
  },

  /**
   * Generates a guest ID and token for unauthenticated users.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  generateGuestId: async (req, res) => {
    try {
      const guestId = uuidv4(); // Unique guest identifier
      const token = jwt.sign({ guestId, isGuest: true }, JWT_SECRET, { expiresIn: GUEST_TOKEN_EXPIRATION });

      responseHandler(res, HttpStatus.OK, "success", "Guest ID and token generated successfully", {
        guestId,
        token
      });
    } catch (err) {
      console.error('Guest ID generation error:', err);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Failed to generate guest ID", { error: err.message });
    }
  }
};

export default AuthController;
