import HttpStatus from 'http-status-codes';
import bcrypt from 'bcrypt';
import User from "../models/_user.js";
import { responseHandler } from '../utils/index.js';

const UserController = {
    /* ✅ Get all users with pagination, filtering & sorting */
    get_users: async (req, res) => {
        try {
            const { page, limit } = res.locals.pagination;
            const skip = (page - 1) * limit;

            // Sorting & filtering parameters
            const sort = req.query.sort || 'createdAt';
            const order = req.query.order === 'desc' ? -1 : 1;
            const query = req.query.username ? { username: new RegExp(req.query.username, 'i') } : {};

            // Parallel execution for efficiency
            const [totalItems, users] = await Promise.all([
                User.countDocuments(query),
                User.find(query)
                    .select('-password')
                    .sort({ [sort]: order })
                    .skip(skip)
                    .limit(limit)
                    .lean()
            ]);

            res.locals.setPagination(totalItems);

            responseHandler(res, HttpStatus.OK, "success", "", {
                users,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages: Math.ceil(totalItems / limit),
                    hasMorePages: res.locals.pagination.hasMorePages,
                    links: res.locals.pagination.links
                }
            });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* ✅ Get a single user */
    get_user: async (req, res) => {
        try {
            const user = await User.findById(req.params.id).select('-password').lean();
            if (!user) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "User not found");
            }
            responseHandler(res, HttpStatus.OK, "success", "", { user });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* ✅ Get user statistics */
    get_stats: async (req, res) => {
        const date = new Date();
        const lastYear = new Date(date.setFullYear(date.getFullYear() - 1));

        try {
            const data = await User.aggregate([
                { $match: { createdAt: { $gte: lastYear } } },
                { $project: { month: { $month: "$createdAt" } } },
                { $group: { _id: "$month", total: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]);

            responseHandler(res, HttpStatus.OK, "success", "", { stats: data });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* ✅ Update user */
    update_user: async (req, res) => {
        try {
            const updateData = { ...req.body };
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            const updatedUser = await User.findByIdAndUpdate(
                req.params.id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).select('-password').lean();

            if (!updatedUser) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "User not found");
            }
            responseHandler(res, HttpStatus.OK, "success", "User updated successfully", { updatedUser });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* ✅ Delete user */
    delete_user: async (req, res) => {
        try {
            const deletedUser = await User.findByIdAndDelete(req.params.id);
            if (!deletedUser) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "User not found");
            }
            responseHandler(res, HttpStatus.OK, "success", "User has been deleted successfully");
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    }
};

export default UserController;
