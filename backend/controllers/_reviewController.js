import Review from '../models/_review.js';
import Product from '../models/_product.js';
import { responseHandler } from '../utils/index.js';

const ReviewController = {
  // Create a new review
  async create_review(req, res) {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;

    try {
      const product = await Product.findById(productId);
      if (!product) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Product not found');
      }

      const newReview = new Review({
        productId,
        userId,
        rating,
        comment,
      });

      const savedReview = await newReview.save();
      responseHandler(res, HttpStatus.CREATED, 'success', 'Review created successfully', { review: savedReview });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },

  // Get all reviews for a product
  async get_reviews(req, res) {
    const { productId } = req.params;

    try {
      const reviews = await Review.find({ productId });
      responseHandler(res, HttpStatus.OK, 'success', '', { reviews });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },

  // Update a review
  async update_review(req, res) {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    try {
      const review = await Review.findById(reviewId);
      if (!review) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Review not found');
      }

      if (review.userId.toString() !== userId) {
        return responseHandler(res, HttpStatus.FORBIDDEN, 'error', 'Unauthorized to update this review');
      }

      review.rating = rating;
      review.comment = comment;
      const updatedReview = await review.save();
      responseHandler(res, HttpStatus.OK, 'success', 'Review updated successfully', { review: updatedReview });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },

  // Delete a review
  async delete_review(req, res) {
    const { reviewId } = req.params;
    const userId = req.user.id;

    try {
      const review = await Review.findById(reviewId);
      if (!review) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Review not found');
      }

      if (review.userId.toString() !== userId) {
        return responseHandler(res, HttpStatus.FORBIDDEN, 'error', 'Unauthorized to delete this review');
      }

      await review.remove();
      responseHandler(res, HttpStatus.OK, 'success', 'Review deleted successfully');
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },
};

export default ReviewController;
