import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import Product from "../models/_product.js";
import { responseHandler } from '../utils/index.js';

const ProductController = {
    /* get all products */
    get_products: async (req, res) => {
        const qNew = req.query.new;
        const qCategory = req.query.category;

        try {
            let products;

            if (qNew) {
                products = await Product.find()
                    .sort({ createdAt: -1 })
                    .limit(5);
            } else if (qCategory) {
                products = await Product.find({
                    categories: {
                        $in: [qCategory]
                    }
                });
            } else {
                products = await Product.find();
            }
            responseHandler(res, HttpStatus.OK, 'success', '', { products });
        } catch (err) {
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
        }
    },

    /* search products */
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

    /* get single product */
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
            } else {
                responseHandler(res, HttpStatus.OK, 'success', '', { product });
            }
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
            console.error(`Invalid ObjectId format: ${id}`);
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        const existing = await Product.findById(id);
        if (!existing) {
            return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
        } else {
            try {
                const updatedProduct = await Product.findByIdAndUpdate(id, {
                    $set: req.body
                }, { new: true });
                responseHandler(res, HttpStatus.OK, 'success', 'Product updated successfully', { updatedProduct });
            } catch (err) {
                responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
            }
        }
    },

    /* delete product */
    delete_product: async (req, res) => {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error(`Invalid ObjectId format: ${id}`);
            return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid product ID format');
        }

        const existing = await Product.findById(id);
        if (!existing) {
            return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "Product doesn't exist");
        } else {
            try {
                await Product.findByIdAndDelete(id);
                responseHandler(res, HttpStatus.OK, 'success', 'Product has been deleted successfully');
            } catch (err) {
                responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong please try again', { err });
            }
        }
    }
};

export default ProductController;
