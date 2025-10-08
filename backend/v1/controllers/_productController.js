import HttpStatus from "http-status-codes";
import { ProductService } from "../services/_productService.js";
import { responseHandler } from "../utils/index.js";

const SUCCESS_MESSAGE = "success";
const ERROR_MESSAGE_TYPE = "error";
const MESSAGES = {
  PRODUCT_DELETED: "Product has been deleted successfully",
  PRODUCT_CREATED: "Product created successfully",
  PRODUCT_UPDATED: "Product updated successfully",
  SERVER_ERROR: "Something went wrong, please try again",
  INVALID_PRODUCT_ID: "Invalid product ID format",
  PRODUCT_NOT_FOUND: "Product doesn't exist",
  CONCURRENCY_CONFLICT: "Product was modified by another request. Please retry.",
};

export class ProductController {
  /**
   * Retrieves all products with pagination, filtering, and sorting.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getProducts(req, res) {
    try {
      const { page, limit, hasMorePages, links } = res.locals.pagination;
      const { new: qNew, category: qCategory, sort, order } = req.query;

      const { products, pagination } = await ProductService.getProducts({
        page,
        limit,
        qNew,
        qCategory,
        sort,
        order,
      });

      res.locals.setPagination(pagination.totalItems);

      responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, "", {
        products,
        pagination: {
          ...pagination,
          hasMorePages,
          links,
        },
      });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, MESSAGES.SERVER_ERROR, {
        error: err.message,
      });
    }
  }

  /**
   * Retrieves a single product by ID.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async getProduct(req, res) {
    try {
      const product = await ProductService.getProduct(req.params.id);
      responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, "", { product });
    } catch (err) {
      const status = err.message === MESSAGES.INVALID_PRODUCT_ID ? HttpStatus.BAD_REQUEST : err.message === MESSAGES.PRODUCT_NOT_FOUND ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, ERROR_MESSAGE_TYPE, err.message, { error: err.message });
    }
  }

  /**
   * Creates a new product.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async createProduct(req, res) {
    try {
      const savedProduct = await ProductService.createProduct(req.body);
      responseHandler(res, HttpStatus.CREATED, SUCCESS_MESSAGE, MESSAGES.PRODUCT_CREATED, { savedProduct });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, MESSAGES.SERVER_ERROR, {
        error: err.message,
      });
    }
  }

  /**
   * Updates an existing product.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async updateProduct(req, res) {
    try {
      const updatedProduct = await ProductService.updateProduct(req.params.id, req.body);
      responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, MESSAGES.PRODUCT_UPDATED, { updatedProduct });
    } catch (err) {
      const status =
        err.message === MESSAGES.INVALID_PRODUCT_ID
          ? HttpStatus.BAD_REQUEST
          : err.message === MESSAGES.PRODUCT_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : err.message === MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, ERROR_MESSAGE_TYPE, err.message, { error: err.message });
    }
  }

  /**
   * Deletes a product.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @returns {Promise<void>}
   */
  static async deleteProduct(req, res) {
    try {
      await ProductService.deleteProduct(req.params.id);
      responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, MESSAGES.PRODUCT_DELETED);
    } catch (err) {
      const status =
        err.message === MESSAGES.INVALID_PRODUCT_ID
          ? HttpStatus.BAD_REQUEST
          : err.message === MESSAGES.PRODUCT_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : err.message === MESSAGES.CONCURRENCY_CONFLICT
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
      responseHandler(res, status, ERROR_MESSAGE_TYPE, err.message, { error: err.message });
    }
  }
}

export default ProductController;
