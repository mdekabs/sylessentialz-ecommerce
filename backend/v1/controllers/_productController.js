import HttpStatus from "http-status-codes";
import mongoose from "mongoose";
import { Product } from "../models/index.js"; // Assumes this imports the updated Product model
import { responseHandler } from "../utils/index.js";
import { esClient } from "../elasticsearch.js";

// Constants
const DEFAULT_SORT_FIELD = "createdAt";
const SORT_DESC = -1;
const SORT_ASC = 1;
const NEW_PRODUCTS_LIMIT = 5;
const DEFAULT_INDEX = "products";
const ERROR_MESSAGE = "Something went wrong, please try again";
const SUCCESS_MESSAGE = "success";
const ERROR_MESSAGE_TYPE = "error";
const INVALID_PRODUCT_ID = "Invalid product ID format";
const PRODUCT_NOT_FOUND = "Product doesn't exist";
const PRODUCT_DELETED = "Product has been deleted successfully";
const PRODUCT_CREATED = "Product created successfully";
const PRODUCT_UPDATED = "Product updated successfully";
const SEARCH_QUERY_REQUIRED = "Search query is required";
const CONCURRENCY_CONFLICT = "Product was modified by another request. Please retry.";

const ProductController = {
    /* Get all products with pagination */
    get_products: async (req, res) => {
        const qNew = req.query.new;
        const qCategory = req.query.category;
        const { page, limit } = res.locals.pagination;
        const skip = (page - 1) * limit;

        try {
            let query = {};
            let sort = {};
            let limitOverride = limit;

            if (qNew) {
                sort = { createdAt: SORT_DESC };
                limitOverride = NEW_PRODUCTS_LIMIT;
            } else if (qCategory) {
                query = { category: qCategory }; // Adjusted to match single category field
            }

            if (!qNew) {
                const sortField = req.query.sort || DEFAULT_SORT_FIELD;
                const order = req.query.order === "desc" ? SORT_DESC : SORT_ASC;
                sort = { [sortField]: order };
            }

            const [totalItems, products] = await Promise.all([
                Product.countDocuments(query),
                Product.find(query)
                    .sort(sort)
                    .skip(qNew ? 0 : skip)
                    .limit(qNew ? limitOverride : limit)
                    .lean()
            ]);

            res.locals.setPagination(totalItems);

            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, "", {
                products,
                pagination: {
                    page,
                    limit: qNew ? limitOverride : limit,
                    totalItems,
                    totalPages: Math.ceil(totalItems / (qNew ? limitOverride : limit)),
                    hasMorePages: res.locals.pagination.hasMorePages,
                    links: res.locals.pagination.links,
                },
            });
        } catch (err) {
            console.error("Get products error:", err);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { error: err.message });
        }
    },

    /* Search products using Elasticsearch */
    search_products: async (req, res) => {
        const query = req.query.q?.trim();

        if (!query) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, SEARCH_QUERY_REQUIRED);
        }

        try {
            const result = await esClient.search({
                index: DEFAULT_INDEX,
                body: {
                    query: {
                        multi_match: {
                            query: query,
                            fields: ["name", "description", "category"],
                            fuzziness: "AUTO",
                        },
                    },
                },
            });

            const products = result.hits?.hits?.map((hit) => ({
                id: hit._id,
                ...hit._source,
                score: hit._score
            })) || [];

            return responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, "", { products });
        } catch (err) {
            console.error("Elasticsearch search error:", err);
            return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { error: err.message });
        }
    },

    /* Get a single product */
    get_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, INVALID_PRODUCT_ID);
        }

        try {
            const product = await Product.findById(id).lean();
            if (!product) {
                return responseHandler(res, HttpStatus.NOT_FOUND, ERROR_MESSAGE_TYPE, PRODUCT_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, "", { product });
        } catch (err) {
            console.error("Get product error:", err);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { error: err.message });
        }
    },

    /* Create a new product */
    create_product: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const newProduct = new Product({
                ...req.body,
                stock: req.body.stock || 0, // Ensure stock is defined
                version: 0 // Initialize version for optimistic locking
            });

            const savedProduct = await newProduct.save({ session });

            // Manually index in Elasticsearch since indexAutomatically is false
            await esClient.index({
                index: DEFAULT_INDEX,
                id: savedProduct._id.toString(),
                body: {
                    name: savedProduct.name,
                    description: savedProduct.description,
                    price: savedProduct.price,
                    category: savedProduct.category,
                    image: savedProduct.image
                },
            });

            await session.commitTransaction();

            responseHandler(res, HttpStatus.CREATED, SUCCESS_MESSAGE, PRODUCT_CREATED, { savedProduct });
        } catch (err) {
            await session.abortTransaction();
            console.error("Create product error:", err);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { error: err.message });
        } finally {
            session.endSession();
        }
    },

    /* Update a product */
    update_product: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, INVALID_PRODUCT_ID);
            }

            const product = await Product.findById(id).session(session);
            if (!product) {
                return responseHandler(res, HttpStatus.NOT_FOUND, ERROR_MESSAGE_TYPE, PRODUCT_NOT_FOUND);
            }

            const currentVersion = product.version || 0; // Fallback to 0 if version isn’t present
            const updatedProduct = await Product.findOneAndUpdate(
                { _id: id, version: currentVersion },
                { $set: { ...req.body, version: currentVersion + 1 } },
                { new: true, runValidators: true, session }
            );

            if (!updatedProduct) {
                throw new Error(CONCURRENCY_CONFLICT);
            }

            // Manually update Elasticsearch
            await esClient.update({
                index: DEFAULT_INDEX,
                id: id,
                body: {
                    doc: {
                        name: updatedProduct.name,
                        description: updatedProduct.description,
                        price: updatedProduct.price,
                        category: updatedProduct.category,
                        image: updatedProduct.image
                    },
                },
            });

            await session.commitTransaction();

            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, PRODUCT_UPDATED, { updatedProduct });
        } catch (err) {
            await session.abortTransaction();
            console.error("Update product error:", err);
            responseHandler(res, 
                err.message === CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, 
                ERROR_MESSAGE_TYPE, 
                err.message
            );
        } finally {
            session.endSession();
        }
    },

    /* Delete a product */
    delete_product: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, INVALID_PRODUCT_ID);
            }

            const product = await Product.findById(id).session(session);
            if (!product) {
                return responseHandler(res, HttpStatus.NOT_FOUND, ERROR_MESSAGE_TYPE, PRODUCT_NOT_FOUND);
            }

            const currentVersion = product.version || 0; // Fallback to 0 if version isn’t present
            const deletedProduct = await Product.findOneAndDelete(
                { _id: id, version: currentVersion },
                { session }
            );
            if (!deletedProduct) {
                throw new Error(CONCURRENCY_CONFLICT);
            }

            // Manually remove from Elasticsearch
            await esClient.delete({
                index: DEFAULT_INDEX,
                id: id,
            });

            await session.commitTransaction();

            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, PRODUCT_DELETED);
        } catch (err) {
            await session.abortTransaction();
            console.error("Delete product error:", err);
            responseHandler(res, 
                err.message === CONCURRENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, 
                ERROR_MESSAGE_TYPE, 
                err.message
            );
        } finally {
            session.endSession();
        }
    },
};

export default ProductController;
