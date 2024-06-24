import Review from '../models/_review.js';
import Product from '../models/_product.js';

const ReviewController = {
  // Create a new review
  async create_review(req, res) {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;

    try {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          type: 'error',
          message: 'Product not found',
        });
      }

      const newReview = new Review({
        productId,
        userId,
        rating,
        comment,
      });

      const savedReview = await newReview.save();
      res.status(201).json({
        type: 'success',
        message: 'Review created successfully',
        review: savedReview,
      });
    } catch (err) {
      res.status(500).json({
        type: 'error',
        message: 'Something went wrong, please try again',
        err,
      });
    }
  },

  // Get all reviews for a product
  async get_reviews(req, res) {
    const { productId } = req.params;

    try {
      const reviews = await Review.find({ productId });
      res.status(200).json({
        type: 'success',
        reviews,
      });
    } catch (err) {
      res.status(500).json({
        type: 'error',
        message: 'Something went wrong, please try again',
        err,
      });
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
        return res.status(404).json({
          type: 'error',
          message: 'Review not found',
        });
      }

      if (review.userId.toString() !== userId) {
        return res.status(403).json({
          type: 'error',
          message: 'Unauthorized to update this review',
        });
      }

      review.rating = rating;
      review.comment = comment;
      const updatedReview = await review.save();
      res.status(200).json({
        type: 'success',
        message: 'Review updated successfully',
        review: updatedReview,
      });
    } catch (err) {
      res.status(500).json({
        type: 'error',
        message: 'Something went wrong, please try again',
        err,
      });
    }
  },

  // Delete a review
  async delete_review(req, res) {
    const { reviewId } = req.params;
    const userId = req.user.id;

    try {
      const review = await Review.findById(reviewId);
      if (!review) {
        return res.status(404).json({
          type: 'error',
          message: 'Review not found',
        });
      }

      if (review.userId.toString() !== userId) {
        return res.status(403).json({
          type: 'error',
          message: 'Unauthorized to delete this review',
        });
      }

      await review.remove();
      res.status(200).json({
        type: 'success',
        message: 'Review deleted successfully',
      });
    } catch (err) {
      res.status(500).json({
        type: 'error',
        message: 'Something went wrong, please try again',
        err,
      });
    }
  },
};

export default ReviewController;
