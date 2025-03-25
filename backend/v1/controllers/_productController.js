import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import { Product } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

const ProductController = {
    /* get all products with pagination */
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
                const sortField = req.query.sort || 'createdAt';
                const order = req.query.order === 'desc' ? -1 : 1;
                sort = { [sortField]: order };
            }

            const [totalItems, products] = await Promise.all([
                Product.countDocuments(query),
                Product.find(query)
                    .sort(sort)
                    .skip(qNew ? 0 : skip)
                    .limit(qNew ? limitOverride : limit)
            ]);

            res.locals.setPagination(totalItems);

            responseHandler(res, HttpStatus.OK, 'success', '', {
                products,
                pagination: {
                    page,
                    limit: qNew ? limitOverride : limit,
                    totalItems,
                    totalPages: Math.ceil(totalItems / (qNew ? limitOverride : limit)),
                    hasMorePages: res.locals.pagination.hasMorePages,
                    links: res.locals.pagination.links
                }
            });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* search products using Elasticsearch */
    search_products: async (req, res) => {
        const query = req.query.q?.trim();

        if (!query) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Search query is required");
        }

        try {
            if (!global.esClient) {
                throw new Error("Elasticsearch client is not initialized");
            }

            Product.search(
                {
                    multi_match: {
                        query: query,
                        fields: ["title", "description", "categories"],
                        fuzziness: "AUTO",
                    },
                },
                (err, results) => {
                    if (err) {
                        console.error("Elasticsearch error:", err);
                        return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong, please try again", { err });
                    }
                    return responseHandler(res, HttpStatus.OK, "success", "", { products: results.hits.hits });
                }
            );
        } catch (err) {
            console.error("Search error:", err);
            return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Something went wrong please try again", { err });
        }
    },

    /* get single product */
    get_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        try {
            const product = await Product.findById(id);
            if (!product) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
            }
            responseHandler(res, HttpStatus.OK, 'success', '', { product });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* create new product */
    create_product: async (req, res) => {
        const newProduct = new Product(req.body);
        try {
            const savedProduct = await newProduct.save();
            responseHandler(res, HttpStatus.CREATED, 'success', 'Product created successfully', { savedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* update product */
    update_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        try {
            const updatedProduct = await Product.findByIdAndUpdate(id, { $set: req.body }, { new: true });
            if (!updatedProduct) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
            }
            responseHandler(res, HttpStatus.OK, 'success', 'Product updated successfully', { updatedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* delete product */
    delete_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        try {
            const deletedProduct = await Product.findByIdAndDelete(id);
            if (!deletedProduct) {
                return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
            }
            responseHandler(res, HttpStatus.OK, 'success', 'Product has been deleted successfully');
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    }
};

export default ProductController;
