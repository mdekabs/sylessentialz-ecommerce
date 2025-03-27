import HttpStatus from 'http-status-codes';
import bcrypt from 'bcryptjs';
import { User } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

const MESSAGES = {
    SUCCESS: "success",
    ERROR: "error",
    USER_NOT_FOUND: "User not found",
    UPDATE_SUCCESS: "User updated successfully",
    DELETE_SUCCESS: "User has been deleted successfully",
    SERVER_ERROR: "Something went wrong, please try again"
};

const SORT_DEFAULT = 'createdAt';
const ORDER_DESC = 'desc';
const PASSWORD_FIELD = '-password';

const UserController = {
    /* ✅ Get all users with pagination, filtering & sorting */
    get_users: async (req, res) => {
        try {
            const { page, limit } = res.locals.pagination;
            const skip = (page - 1) * limit;

            // Sorting & filtering parameters
            const sort = req.query.sort || SORT_DEFAULT;
            const order = req.query.order === ORDER_DESC ? -1 : 1;
            const query = req.query.username ? { username: new RegExp(req.query.username, 'i') } : {};

            // Parallel execution for efficiency
            const [totalItems, users] = await Promise.all([
                User.countDocuments(query),
                User.find(query)
                    .select(PASSWORD_FIELD)
                    .sort({ [sort]: order })
                    .skip(skip)
                    .limit(limit)
                    .lean()
            ]);

            res.locals.setPagination(totalItems);

            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", {
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
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    },

    /* ✅ Get a single user */
    get_user: async (req, res) => {
        try {
            const user = await User.findById(req.params.id).select(PASSWORD_FIELD).lean();
            if (!user) {
                return responseHandler(res, HttpStatus.NOT_FOUND, MESSAGES.ERROR, MESSAGES.USER_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", { user });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    },

    /* ✅ Get user statistics */
    get_stats: async (req, res) => {
        try {
            const date = new Date();
            const lastYear = new Date(date.setFullYear(date.getFullYear() - 1));

            const data = await User.aggregate([
                { $match: { createdAt: { $gte: lastYear } } },
                { $project: { month: { $month: "$createdAt" } } },
                { $group: { _id: "$month", total: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]);

            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", { stats: data });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
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
            ).select(PASSWORD_FIELD).lean();

            if (!updatedUser) {
                return responseHandler(res, HttpStatus.NOT_FOUND, MESSAGES.ERROR, MESSAGES.USER_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, MESSAGES.UPDATE_SUCCESS, { updatedUser });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    },

    /* ✅ Delete user */
    delete_user: async (req, res) => {
        try {
            const deletedUser = await User.findByIdAndDelete(req.params.id);
            if (!deletedUser) {
                return responseHandler(res, HttpStatus.NOT_FOUND, MESSAGES.ERROR, MESSAGES.USER_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, MESSAGES.DELETE_SUCCESS);
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    }
};

export default UserController;
