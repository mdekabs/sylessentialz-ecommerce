import { User } from "../models/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import uuid from "../utils/_uuid.js";
import { emailQueue, generatePasswordResetEmail } from "../utils/index.js";
import { updateBlacklist } from "../middlewares/index.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = "1d";
const PASSWORD_RESET_EXPIRATION = 3600000;
const TOKEN_BYTES = 32;
const GUEST_TOKEN_EXPIRATION = "1h";

export class AuthService {
  /**
   * Registers a new user.
   * @param {Object} data - User data (username, email, password).
   * @returns {Object} Created user.
   * @throws {Error} If user creation fails or email is in use.
   */
  static async createUser({ username, email, password }) {
    if (!username || !email || !password) {
      throw new Error("Username, email, and password are required.");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Email is already in use.");
    }

    const newUser = new User({ username, email, password });
    const user = await newUser.save();
    return user;
  }

  /**
   * Logs in a user and generates a JWT token.
   * @param {Object} data - Login credentials (username, password).
   * @returns {Object} User data and access token.
   * @throws {Error} If login fails (invalid credentials, account locked).
   */
  static async loginUser({ username, password }) {
    if (!username || !password) {
      throw new Error("Username and password are required.");
    }

    const user = await User.findOne({ username });
    if (!user) {
      throw new Error("Invalid username or password.");
    }

    if (!user.canLogin()) {
      throw new Error(`Account locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}`);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error("Incorrect password.");
    }

    await user.resetLoginAttempts();
    const accessToken = jwt.sign({ id: user._id.toString(), isAdmin: user.isAdmin }, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
    });

    const { password: _, ...data } = user._doc;
    return { ...data, accessToken };
  }

  /**
   * Logs out a user by blacklisting their token.
   * @param {string} token - JWT token to blacklist.
   * @throws {Error} If logout fails.
   */
  static async logoutUser(token) {
    try {
      await updateBlacklist(token);
    } catch (err) {
      throw new Error(`Logout failed: ${err.message}`);
    }
  }

  /**
   * Initiates a password reset process by generating a token and queuing an email.
   * @param {string} email - User's email.
   * @throws {Error} If user not found or email queuing fails.
   */
  static async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found.");
    }

    const resetToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + PASSWORD_RESET_EXPIRATION;
    await user.save();

    await emailQueue.add("sendEmail", generatePasswordResetEmail(user.email, resetToken));
  }

  /**
   * Resets a user's password using a valid token.
   * @param {Object} data - Reset data (token, newPassword).
   * @throws {Error} If token is invalid/expired or reset fails.
   */
  static async resetPassword({ token, newPassword }) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      throw new Error("Invalid or expired token.");
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
  }

  /**
   * Generates a guest ID and token.
   * @returns {Object} Guest ID and token.
   * @throws {Error} If generation fails.
   */
  static async generateGuestId() {
    try {
      const guestId = uuid.generate();
      const token = jwt.sign({ guestId, isGuest: true }, JWT_SECRET, {
        expiresIn: GUEST_TOKEN_EXPIRATION,
      });
      return { guestId, token };
    } catch (err) {
      throw new Error(`Failed to generate guest ID: ${err.message}`);
    }
  }
}