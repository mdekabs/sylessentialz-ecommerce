import User from "../models/_user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

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
    }
};

export default AuthController;
