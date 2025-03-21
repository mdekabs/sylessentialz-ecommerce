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

            // Handle special query parameters
            if (qNew) {
                sort = { createdAt: -1 };
                limitOverride = 5; // Override pagination limit for "new" products
            } else if (qCategory) {
                query = {
                    categories: { $in: [qCategory] }
                };
            }

            // Optional sorting parameters (if not already set by qNew)
            if (!qNew) {
                const sortField = req.query.sort || 'createdAt';
                const order = req.query.order === 'desc' ? -1 : 1;
                sort = { [sortField]: order };
            }

            // Parallel execution for count and data
            const [totalItems, products] = await Promise.all([
                Product.countDocuments(query),
                Product.find(query)
                    .sort(sort)
                    .skip(qNew ? 0 : skip) // Skip not applied for qNew since limit is fixed
                    .limit(qNew ? limitOverride : limit)
            ]);

            // Set pagination metadata (adjusted for qNew case)
            res.locals.setPagination(totalItems);

            const responseData = {
                products,
                pagination: {
                    page,
                    limit: qNew ? limitOverride : limit,
                    totalItems,
                    totalPages: Math.ceil(totalItems / (qNew ? limitOverride : limit)),
                    hasMorePages: res.locals.pagination.hasMorePages,
                    links: res.locals.pagination.links
                }
            };

            responseHandler(res, HttpStatus.OK, 'success', '', responseData);
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* search products (pagination not applied here) */
    search_products: async (req, res) => {
        const query = req.query.q;

        try {
            const products = await Product.search({
                query_string: {
                    query: query
                }
            });
            responseHandler(res, HttpStatus.OK, 'success', '', { products });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* get single product (no pagination needed) */
    get_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error(`Invalid ObjectId format: ${id}`);
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

    /* create new product (no pagination needed) */
    create_product: async (req, res) => {
        const newProduct = new Product(req.body);
        try {
            const savedProduct = await newProduct.save();
            responseHandler(res, HttpStatus.CREATED, 'success', 'Product created successfully', { savedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* update product (no pagination needed) */
    update_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error(`Invalid ObjectId format: ${id}`);
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        const existing = await Product.findById(id);
        if (!existing) {
            return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
        }
        try {
            const updatedProduct = await Product.findByIdAndUpdate(id, {
                $set: req.body
            }, { new: true });
            responseHandler(res, HttpStatus.OK, 'success', 'Product updated successfully', { updatedProduct });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* delete product (no pagination needed) */
    delete_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error(`Invalid ObjectId format: ${id}`);
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        const existing = await Product.findById(id);
        if (!existing) {
            return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
        }
        try {
            await Product.findByIdAndDelete(id);
            responseHandler(res, HttpStatus.OK, 'success', 'Product has been deleted successfully');
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    }
};

export default ProductController;
