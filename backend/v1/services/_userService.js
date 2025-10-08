import bcrypt from "bcryptjs";
import { User } from "../models/index.js";

const SORT_DEFAULT = "createdAt";
const ORDER_DESC = "desc";
const PASSWORD_FIELD = "-password";

export class UserService {
  /**
   * Retrieves all users with pagination, filtering, and sorting.
   * @param {Object} options - Query options (page, limit, sort, order, username).
   * @returns {Object} Users and pagination data.
   * @throws {Error} If query fails.
   */
  static async getUsers({ page, limit, sort = SORT_DEFAULT, order = ORDER_DESC, username }) {
    try {
      const skip = (page - 1) * limit;
      const sortOrder = order === ORDER_DESC ? -1 : 1;
      const query = username ? { username: new RegExp(username, "i") } : {};

      const [totalItems, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query)
          .select(PASSWORD_FIELD)
          .sort({ [sort]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    } catch (err) {
      throw new Error(`Failed to retrieve users: ${err.message}`);
    }
  }

  /**
   * Retrieves a single user by ID.
   * @param {string} id - User ID.
   * @returns {Object} User data.
   * @throws {Error} If user not found or query fails.
   */
  static async getUser(id) {
    try {
      const user = await User.findById(id).select(PASSWORD_FIELD).lean();
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    } catch (err) {
      throw new Error(err.message === "User not found" ? err.message : `Failed to retrieve user: ${err.message}`);
    }
  }

  /**
   * Retrieves user registration statistics for the past year.
   * @returns {Array} Statistics data.
   * @throws {Error} If aggregation fails.
   */
  static async getStats() {
    try {
      const date = new Date();
      const lastYear = new Date(date.setFullYear(date.getFullYear() - 1));

      const data = await User.aggregate([
        { $match: { createdAt: { $gte: lastYear } } },
        { $project: { month: { $month: "$createdAt" } } },
        { $group: { _id: "$month", total: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      return data;
    } catch (err) {
      throw new Error(`Failed to retrieve stats: ${err.message}`);
    }
  }

  /**
   * Updates a user's details, hashing password if provided.
   * @param {string} id - User ID.
   * @param {Object} updateData - Data to update.
   * @returns {Object} Updated user data.
   * @throws {Error} If user not found or update fails.
   */
  static async updateUser(id, updateData) {
    try {
      const data = { ...updateData };
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }

      const updatedUser = await User.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
        .select(PASSWORD_FIELD)
        .lean();

      if (!updatedUser) {
        throw new Error("User not found");
      }
      return updatedUser;
    } catch (err) {
      throw new Error(err.message === "User not found" ? err.message : `Failed to update user: ${err.message}`);
    }
  }

  /**
   * Deletes a user by ID.
   * @param {string} id - User ID.
   * @throws {Error} If user not found or deletion fails.
   */
  static async deleteUser(id) {
    try {
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) {
        throw new Error("User not found");
      }
    } catch (err) {
      throw new Error(err.message === "User not found" ? err.message : `Failed to delete user: ${err.message}`);
    }
  }
}
