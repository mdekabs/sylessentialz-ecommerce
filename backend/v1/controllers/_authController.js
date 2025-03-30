import HttpStatus from "http-status-codes";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import { responseHandler, emailQueue, generatePasswordResetEmail } from "../utils/index.js";
import { updateBlacklist } from "../middlewares/index.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = "1d";
const PASSWORD_RESET_EXPIRATION = 3600000; // 1 hour
const TOKEN_BYTES = 32;

const AuthController = {
  create_admin_user: async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;

      const existingAdmin = await User.findOne({ email: adminEmail });
      if (existingAdmin) {
        console.log("ℹ️ Admin user already exists.");
        return;
      }

      const newAdmin = new User({
        username: adminUsername, // Pre-save will lowercase
        email: adminEmail,
        password: adminPassword, // Pre-save will hash
        isAdmin: true,
      });

      await newAdmin.save();
      console.log("✅ Admin user created successfully!");
    } catch (err) {
      console.error("❌ Failed to create admin user:", err.message);
    }
  },

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

      const newUser = new User({ username, email, password }); // Pre-save handles hashing and lowercasing
      const user = await newUser.save();

      responseHandler(res, HttpStatus.CREATED, "success", "User has been created successfully", { user });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "User creation failed: " + err.message);
    }
  },

  login_user: async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Username and password are required.");
      }

      const user = await User.findOne({ username }); // Model lowercases username
      if (!user) {
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", "Invalid username or password.");
      }

      if (!user.canLogin()) {
        return responseHandler(res, HttpStatus.FORBIDDEN, "error", `Account locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}`);
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        // Simplified error message; lockout message handled by canLogin check
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", "Incorrect password.");
      }

      await user.resetLoginAttempts();

      const accessToken = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
      const { password: _, ...data } = user._doc;

      responseHandler(res, HttpStatus.OK, "success", "Successfully logged in", { ...data, accessToken });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Login failed: " + err.message);
    }
  },

  logout_user: async (req, res) => {
    try {
      const token = req.header("Authorization").replace("Bearer ", "");
      await updateBlacklist(token);
      responseHandler(res, HttpStatus.OK, "success", "Successfully logged out.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Logout failed: " + err.message);
    }
  },

  forgot_password: async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return responseHandler(res, HttpStatus.NOT_FOUND, "error", "User not found.");
      }

      const resetToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + PASSWORD_RESET_EXPIRATION;
      await user.save();

      await emailQueue.add("sendEmail", generatePasswordResetEmail(user.email, resetToken));
      responseHandler(res, HttpStatus.OK, "success", "Password reset email sent.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Forgot password failed: " + err.message);
    }
  },

  reset_password: async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
      if (!user) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid or expired token.");
      }

      user.password = newPassword; // Pre-save will hash
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      responseHandler(res, HttpStatus.OK, "success", "Password reset successful.");
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Password reset failed: " + err.message);
    }
  },
};

export default AuthController;
