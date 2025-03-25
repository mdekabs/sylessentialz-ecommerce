import HttpStatus from "http-status-codes";
import mongoose from "mongoose";
import { Product } from "../models/index.js";
import { responseHandler } from "../utils/index.js";
import { esClient } from "../elasticsearch.js"; // Import Elasticsearch client

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
                sort = { createdAt: -1 };
                limitOverride = 5;
            } else if (qCategory) {
                query = { categories: { $in: [qCategory] } };
            }

            if (!qNew) {
                const sortField = req.query.sort || "createdAt";
                const order = req.query.order === "desc" ? -1 : 1;
                sort = { [sortField]: order };
            }

            const [totalItems, products] = await Promise.all([
                Product.countDocuments(query),
                Product.find(query).sort(sort).skip(qNew ? 0 : skip).limit(qNew ? limitOverride : limit),
            ]);

            res.locals.setPagination(totalItems);

            responseHandler(res, HttpStatus.OK, "success", "", {
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
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* Search products using Elasticsearch */
    search_products: async (req, res) => {
        const query = req.query.q?.trim();

        if (!query) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Search query is required");
        }

        try {
            const result = await esClient.search({
                index: "products",
                body: {
                    query: {
                        multi_match: {
                            query: query,
                            fields: ["title", "description", "categories"],
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

            return responseHandler(res, HttpStatus.OK, "success", "", { products });
        } catch (err) {
            console.error("Elasticsearch search error:", err);
            return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* Get a single product */
    get_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid product ID format");
        }

        try {
            const product = await Product.findById(id);
            if (!product) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Product doesn't exist");
            }
            responseHandler(res, HttpStatus.OK, "success", "", { product });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* Create a new product */
    create_product: async (req, res) => {
        const newProduct = new Product(req.body);
        try {
            const savedProduct = await newProduct.save();

            // Index product in Elasticsearch
            await esClient.index({
                index: "products",
                id: savedProduct._id.toString(),
                body: savedProduct.toObject(),
            });

            responseHandler(res, HttpStatus.CREATED, "success", "Product created successfully", { savedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* Update a product */
    update_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid product ID format");
        }

        try {
            const updatedProduct = await Product.findByIdAndUpdate(id, { $set: req.body }, { new: true });

            if (!updatedProduct) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Product doesn't exist");
            }

            // Update Elasticsearch index
            await esClient.update({
                index: "products",
                id: id,
                body: {
                    doc: req.body,
                },
            });

            responseHandler(res, HttpStatus.OK, "success", "Product updated successfully", { updatedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },

    /* Delete a product */
    delete_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid product ID format");
        }

        try {
            const deletedProduct = await Product.findByIdAndDelete(id);
            if (!deletedProduct) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Product doesn't exist");
            }

            // Remove from Elasticsearch index
            await esClient.delete({
                index: "products",
                id: id,
            });

            responseHandler(res, HttpStatus.OK, "success", "Product has been deleted successfully");
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
        }
    },
};

export default ProductController;
