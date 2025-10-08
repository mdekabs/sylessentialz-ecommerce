import HttpStatus from "http-status-codes";
import { UserService } from "../services/_userService.js";
import { responseHandler } from "../utils/index.js";

const MESSAGES = {
  SUCCESS: "success",
  ERROR: "error",
  USER_NOT_FOUND: "User not found",
  UPDATE_SUCCESS: "User updated successfully",
  DELETE_SUCCESS: "User has been deleted successfully",
  SERVER_ERROR: "Something went wrong, please try again",
};

export class UserController {
  /**
   * Retrieves all users with pagination, filtering, and sorting.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getUsers(req, res) {
    try {
      const { page, limit, hasMorePages, links } = res.locals.pagination;
      const { sort, order, username } = req.query;

      const { users, pagination } = await UserService.getUsers({
        page,
        limit,
        sort,
        order,
        username,
      });

      res.locals.setPagination(pagination.totalItems);

      responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", {
        users,
        pagination: {
          ...pagination,
          hasMorePages,
          links,
        },
      });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
    }
  }

  /**
   * Retrieves a single user by ID.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getUser(req, res) {
    try {
      const user = await UserService.getUser(req.params.id);
      responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", { user });
    } catch (err) {
      responseHandler(
        res,
        err.message === MESSAGES.USER_NOT_FOUND ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
        MESSAGES.ERROR,
        err.message,
        { err }
      );
    }
  }

  /**
   * Retrieves user registration statistics.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getStats(req, res) {
    try {
      const stats = await UserService.getStats();
      responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, "", { stats });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, MESSAGES.ERROR, MESSAGES.SERVER_ERROR, { err });
    }
  }

  /**
   * Updates a user's details.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async updateUser(req, res) {
    try {
      const updatedUser = await UserService.updateUser(req.params.id, req.body);
      responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, MESSAGES.UPDATE_SUCCESS, { updatedUser });
    } catch (err) {
      responseHandler(
        res,
        err.message === MESSAGES.USER_NOT_FOUND ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
        MESSAGES.ERROR,
        err.message,
        { err }
      );
    }
  }

  /**
   * Deletes a user by ID.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async deleteUser(req, res) {
    try {
      await UserService.deleteUser(req.params.id);
      responseHandler(res, HttpStatus.OK, MESSAGES.SUCCESS, MESSAGES.DELETE_SUCCESS);
    } catch (err) {
      responseHandler(
        res,
        err.message === MESSAGES.USER_NOT_FOUND ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
        MESSAGES.ERROR,
        err.message,
        { err }
      );
    }
  }
}

export default UserController;
