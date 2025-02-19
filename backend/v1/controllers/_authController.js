import HttpStatus from 'http-status-codes';
import User from "../models/_user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import { responseHandler, emailQueue, generatePasswordResetEmail } from "../utils/index.js";
import { updateBlacklist } from "./middlewares/index.js";

dotenv.config();

// Constants for better readability
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = "1d";
const PASSWORD_RESET_EXPIRATION = 3600000; // 1 hour
const TOKEN_BYTES = 32;
const ERROR_MESSAGES = {
    MISSING_FIELDS: "Username, email, and password are required.",
    EMAIL_EXISTS: "Email is already in use.",
    USER_NOT_FOUND: "No user found with this email.",
    INVALID_CREDENTIALS: "Invalid username or password.",
    INVALID_PASSWORD: "Incorrect password.",
    INVALID_RESET_TOKEN: "Invalid or expired password reset token.",
    PASSWORD_REQUIRED: "New password is required.",
    FAILED_USER_CREATION: "User creation failed: ",
    FAILED_LOGIN: "Login failed: ",
    FAILED_PASSWORD_RESET_REQUEST: "Password reset request failed: ",
    FAILED_PASSWORD_RESET: "Password reset failed: ",
};

const AuthController = {
    create_user: async (req, res) => {
        try {
            const { username, email, password } = req.body;
            if (!username || !email || !password) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.MISSING_FIELDS);
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return responseHandler(res, HttpStatus.CONFLICT, "error", ERROR_MESSAGES.EMAIL_EXISTS);
            }

            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const newUser = new User({ username, email, password: hashedPassword });
            const user = await newUser.save();

            responseHandler(res, HttpStatus.CREATED, "success", "User has been created successfully", { user });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.FAILED_USER_CREATION + err.message);
        }
    },

    login_user: async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Username and password are required.");
            }

            const user = await User.findOne({ username });
            if (!user) {
                return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERROR_MESSAGES.INVALID_CREDENTIALS);
            }

            const isPasswordValid = bcrypt.compareSync(password, user.password);
            if (!isPasswordValid) {
                return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERROR_MESSAGES.INVALID_PASSWORD);
            }

            const accessToken = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
            const { password: _, ...data } = user._doc;
            responseHandler(res, HttpStatus.OK, "success", "Successfully logged in", { ...data, accessToken });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.FAILED_LOGIN + err.message);
        }
    },

    logout_user: async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", "No token provided");
        }

        try {
            await updateBlacklist(token);
            responseHandler(res, HttpStatus.OK, "success", "Successfully logged out");
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { error: err.message });
        }
    },

    forgot_password: async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Email is required.");
            }

            const user = await User.findOne({ email });
            if (!user) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + PASSWORD_RESET_EXPIRATION;
            await user.save();

            const message = generatePasswordResetEmail(req.headers.host, token);
            await emailQueue.add({ to: user.email, subject: message.subject, text: message.message });

            responseHandler(res, HttpStatus.OK, "success", "Password reset email sent successfully.");
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.FAILED_PASSWORD_RESET_REQUEST + err.message);
        }
    },

    reset_password: async (req, res) => {
        try {
            if (!req.body.password) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.PASSWORD_REQUIRED);
            }

            const user = await User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: { $gt: Date.now() }
            });

            if (!user) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGES.INVALID_RESET_TOKEN);
            }

            user.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();

            responseHandler(res, HttpStatus.OK, "success", "Password has been reset successfully.");
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGES.FAILED_PASSWORD_RESET + err.message);
        }
    }
};

export default AuthController;
