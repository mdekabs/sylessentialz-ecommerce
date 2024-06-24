import User from "../models/_user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import { emailQueue } from "../utils/_queue.js";
import generatePasswordResetEmail from "../utils/_emailMessage.js";

dotenv.config();

const AuthController = {
    async create_user(req, res, next) {
        const newUser = new User({
            username: req.body.username,
            email: req.body.email,
            password: bcrypt.hashSync(req.body.password, 10)
        });

        try {
            const user = await newUser.save();
            res.status(201).json({
                type: "success",
                message: "User has been created successfully",
                user
            });
        } catch (err) {
            res.status(500).json({
                type: "error",
                message: "Something went wrong, please try again",
                err
            });
        }
    },

    async login_user(req, res) {
        const user = await User.findOne({ username: req.body.username });

        if (!user || !bcrypt.compareSync(req.body.password, user.password)) {
            res.status(500).json({
                type: "error",
                message: "User does not exist or invalid credentials",
            });
        } else {
            const accessToken = jwt.sign(
                {
                    id: user._id,
                    isAdmin: user.isAdmin
                },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            const { password, ...data } = user._doc;

            res.status(200).json({
                type: "success",
                message: "Successfully logged in",
                ...data,
                accessToken
            });
        }
    },

    async logout_user(req, res) {
        res.status(200).json({
            type: "success",
            message: "Successfully logged out"
        });
    },

    async forgot_password(req, res) {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json({
                type: "error",
                message: "User not found"
            });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const message = generatePasswordResetEmail(req.headers.host, token);

        try {
            // Adding email job to the queue
            await emailQueue.add({
                to: user.email,
                subject: message.subject,
                text: message.message
            });

            res.status(200).json({
                type: "success",
                message: "Password reset email sent successfully"
            });
        } catch (err) {
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();

            res.status(500).json({
                type: "error",
                message: "Failed to send email, please try again"
            });
        }
    },

    async reset_password(req, res) {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                type: "error",
                message: "Password reset token is invalid or has expired"
            });
        }

        user.password = bcrypt.hashSync(req.body.password, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.status(200).json({
            type: "success",
            message: "Password has been reset successfully"
        });
    }
};

export default AuthController;
