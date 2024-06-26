import { searchProducts } from '../services/_elasticsearch.js';

const SearchController = {
    async search(req, res) {
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({
                type: "error",
                message: "Search query is required"
            });
        }

        try {
            const results = await searchProducts(query);
            const products = results.map(hit => hit._source);

            res.status(200).json({
                type: "success",
                products
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
