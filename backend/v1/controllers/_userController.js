import HttpStatus from 'http-status-codes';
import bcrypt from 'bcryptjs';
import { User } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

/**
 * Messages for user operations.
 */
const MESSAGES = {
    SUCCESS: "success",                      // Success response type
    ERROR: "error",                          // Error response type
    USER_NOT_FOUND: "User not found",
    UPDATE_SUCCESS: "User updated successfully",
    DELETE_SUCCESS: "User has been deleted successfully",
    SERVER_ERROR: "Something went wrong, please try again"
};

/**
 * Constants for user operations.
 */
const SORT_DEFAULT = 'createdAt';            // Default sort field
const ORDER_DESC = 'desc';                   // Descending order identifier
const PASSWORD_FIELD = '-password';          // Exclude password from queries

/**
 * Controller for managing user operations.
 */
const UserController = {
    /**
     * Retrieves all users with pagination, filtering, and sorting.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    get_users: async (req, res) => {
        try {
            const { page, limit } = res.locals.pagination; // From pagination middleware
            const skip = (page - 1) * limit;               // Calculate skip value

            // Sorting & filtering parameters
            const sort = req.query.sort || SORT_DEFAULT;   // Default to createdAt
            const order = req.query.order === ORDER_DESC ? -1 : 1; // Sort direction
            const query = req.query.username ? { username: new RegExp(req.query.username, 'i') } : {}; // Case-insensitive username filter

            // Parallel execution for efficiency
            const [totalItems, users] = await Promise.all([
                User.countDocuments(query),                // Total matching users
                User.find(query)
                    .select(PASSWORD_FIELD)                // Exclude password
                    .sort({ [sort]: order })               // Apply sorting
                    .skip(skip)                            // Pagination skip
                    .limit(limit)                          // Pagination limit
                    .lean()                                // Return plain JS objects
            ]);

            res.locals.setPagination(totalItems);          // Set pagination metadata

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

    /**
     * Retrieves a single user by ID.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    get_user: async (req, res) => {
        try {
            const user = await User.findById(req.params.id)
                .select(PASSWORD_FIELD)                    // Exclude password
                .lean();
            if (!user) {
                return responseHandler(res, HttpStatus.NOT_FOUND, MESSAGES.ERROR, MESSAGES.USER_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", { user });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    },

    /**
     * Retrieves user registration statistics for the past year.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    get_stats: async (req, res) => {
        try {
            const date = new Date();
            const lastYear = new Date(date.setFullYear(date.getFullYear() - 1)); // One year ago

            const data = await User.aggregate([
                { $match: { createdAt: { $gte: lastYear } } }, // Filter last year's users
                { $project: { month: { $month: "$createdAt" } } }, // Extract month
                { $group: { _id: "$month", total: { $sum: 1 } } }, // Group by month
                { $sort: { _id: 1 } }                      // Sort by month ascending
            ]);

            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", { stats: data });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    },

    /**
     * Updates a user's details, hashing password if provided.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    update_user: async (req, res) => {
        try {
            const updateData = { ...req.body };
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10); // Hash password with 10 salt rounds
            }

            const updatedUser = await User.findByIdAndUpdate(
                req.params.id,
                { $set: updateData },                      // Update specified fields
                { new: true, runValidators: true }         // Return updated doc, validate
            ).select(PASSWORD_FIELD)                       // Exclude password
             .lean();

            if (!updatedUser) {
                return responseHandler(res, HttpStatus.NOT_FOUND, MESSAGES.ERROR, MESSAGES.USER_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, MESSAGES.UPDATE_SUCCESS, { updatedUser });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
        }
    },

    /**
     * Deletes a user by ID.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
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
