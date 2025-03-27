import HttpStatus from "http-status-codes";
import mongoose from "mongoose";
import { Product } from "../models/index.js";
import { responseHandler } from "../utils/index.js";
import { esClient } from "../elasticsearch.js"; // Import Elasticsearch client

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
                query = { categories: { $in: [qCategory] } };
            }

            if (!qNew) {
                const sortField = req.query.sort || DEFAULT_SORT_FIELD;
                const order = req.query.order === "desc" ? SORT_DESC : SORT_ASC;
                sort = { [sortField]: order };
            }

            const [totalItems, products] = await Promise.all([
                Product.countDocuments(query),
                Product.find(query).sort(sort).skip(qNew ? 0 : skip).limit(qNew ? limitOverride : limit),
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
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { err });
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
                            fields: ["name", "description", "category", "title"],
                          //  fuzziness: "AUTO",
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
            return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { err });
        }
    },

    /* Get a single product */
    get_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, INVALID_PRODUCT_ID);
        }

        try {
            const product = await Product.findById(id);
            if (!product) {
                return responseHandler(res, HttpStatus.NOT_FOUND, ERROR_MESSAGE_TYPE, PRODUCT_NOT_FOUND);
            }
            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, "", { product });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { err });
        }
    },

    /* Create a new product */
    create_product: async (req, res) => {
        const newProduct = new Product(req.body);
        try {
            const savedProduct = await newProduct.save();

            responseHandler(res, HttpStatus.CREATED, SUCCESS_MESSAGE, PRODUCT_CREATED, { savedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { err });
        }
    },

    /* Update a product */
    update_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, INVALID_PRODUCT_ID);
        }

        try {
            const updatedProduct = await Product.findByIdAndUpdate(id, { $set: req.body }, { new: true });

            if (!updatedProduct) {
                return responseHandler(res, HttpStatus.NOT_FOUND, ERROR_MESSAGE_TYPE, PRODUCT_NOT_FOUND);
            }

            // Update Elasticsearch index
            await esClient.update({
                index: DEFAULT_INDEX,
                id: id,
                body: {
                    doc: req.body,
                },
            });

            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, PRODUCT_UPDATED, { updatedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { err });
        }
    },

    /* Delete a product */
    delete_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, ERROR_MESSAGE_TYPE, INVALID_PRODUCT_ID);
        }

        try {
            const deletedProduct = await Product.findByIdAndDelete(id);
            if (!deletedProduct) {
                return responseHandler(res, HttpStatus.NOT_FOUND, ERROR_MESSAGE_TYPE, PRODUCT_NOT_FOUND);
            }

            // Remove from Elasticsearch index
            await esClient.delete({
                index: DEFAULT_INDEX,
                id: id,
            });

            responseHandler(res, HttpStatus.OK, SUCCESS_MESSAGE, PRODUCT_DELETED);
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_MESSAGE_TYPE, ERROR_MESSAGE, { err });
        }
    },
};

export default ProductController;
