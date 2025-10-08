import mongoose from "mongoose";
import { Product } from "../models/index.js";

const DEFAULT_SORT_FIELD = "createdAt";
const SORT_DESC = -1;
const SORT_ASC = 1;
const NEW_PRODUCTS_LIMIT = 5;
const ERROR_MESSAGES = {
  INVALID_PRODUCT_ID: "Invalid product ID format",
  PRODUCT_NOT_FOUND: "Product doesn't exist",
  CONCURRENCY_CONFLICT: "Product was modified by another request. Please retry.",
  SERVER_ERROR: "Something went wrong, please try again",
};

export class ProductService {
  /**
   * Retrieves all products with pagination, filtering, and sorting.
   * @param {Object} options - Query options (page, limit, qNew, qCategory, sort, order).
   * @returns {Object} Products and pagination data.
   * @throws {Error} If query fails.
   */
  static async getProducts({ page, limit, qNew, qCategory, sort = DEFAULT_SORT_FIELD, order = "asc" }) {
    try {
      let query = {};
      let sortOptions = {};
      let limitOverride = limit;

      if (qNew) {
        sortOptions = { createdAt: SORT_DESC };
        limitOverride = NEW_PRODUCTS_LIMIT;
      } else if (qCategory) {
        query = { category: qCategory };
      }

      if (!qNew) {
        const sortOrder = order === "desc" ? SORT_DESC : SORT_ASC;
        sortOptions = { [sort]: sortOrder };
      }

      const skip = qNew ? 0 : (page - 1) * limit;

      const [totalItems, products] = await Promise.all([
        Product.countDocuments(query),
        Product.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(qNew ? limitOverride : limit)
          .lean(),
      ]);

      return {
        products,
        pagination: {
          page,
          limit: qNew ? limitOverride : limit,
          totalItems,
          totalPages: Math.ceil(totalItems / (qNew ? limitOverride : limit)),
        },
      };
    } catch (err) {
      throw new Error(`Failed to retrieve products: ${err.message}`);
    }
  }

  /**
   * Retrieves a single product by ID.
   * @param {string} id - Product ID.
   * @returns {Object} Product data.
   * @throws {Error} If ID is invalid or product not found.
   */
  static async getProduct(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(ERROR_MESSAGES.INVALID_PRODUCT_ID);
    }

    try {
      const product = await Product.findById(id).lean();
      if (!product) {
        throw new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
      }
      return product;
    } catch (err) {
      throw new Error(err.message === ERROR_MESSAGES.PRODUCT_NOT_FOUND ? err.message : `Failed to retrieve product: ${err.message}`);
    }
  }

  /**
   * Creates a new product.
   * @param {Object} data - Product data.
   * @returns {Object} Created product.
   * @throws {Error} If creation fails.
   */
  static async createProduct(data) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const newProduct = new Product({
        ...data,
        stock: data.stock || 0,
        version: 0,
      });

      const savedProduct = await newProduct.save({ session });

      await session.commitTransaction();
      return savedProduct;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(`Failed to create product: ${err.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates an existing product.
   * @param {string} id - Product ID.
   * @param {Object} data - Update data.
   * @returns {Object} Updated product.
   * @throws {Error} If ID is invalid, product not found, or update fails.
   */
  static async updateProduct(id, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(ERROR_MESSAGES.INVALID_PRODUCT_ID);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findById(id).session(session);
      if (!product) {
        throw new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
      }

      const currentVersion = product.version || 0;
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: id, version: currentVersion },
        { $set: { ...data, version: currentVersion + 1 } },
        { new: true, runValidators: true, session }
      );

      if (!updatedProduct) {
        throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
      }

      await session.commitTransaction();
      return updatedProduct;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Deletes a product.
   * @param {string} id - Product ID.
   * @throws {Error} If ID is invalid, product not found, or deletion fails.
   */
  static async deleteProduct(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(ERROR_MESSAGES.INVALID_PRODUCT_ID);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await Product.findById(id).session(session);
      if (!product) {
        throw new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
      }

      const currentVersion = product.version || 0;
      const deletedProduct = await Product.findOneAndDelete(
        { _id: id, version: currentVersion },
        { session }
      );
      if (!deletedProduct) {
        throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }
}
