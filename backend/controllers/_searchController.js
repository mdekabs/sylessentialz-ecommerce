import { searchProducts } from '../services/_elasticsearch.js';

const SearchController = {
  async search(req, res) {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({
        type: "error",
        message: "Query parameter 'q' is required"
      });
    }

    try {
      const results = await searchProducts(query);
      res.status(200).json({
        type: "success",
        results
      });
    } catch (err) {
      res.status(500).json({
        type: "error",
        message: "Something went wrong please try again",
        err
      });
    }
  }
};

export default SearchController;
