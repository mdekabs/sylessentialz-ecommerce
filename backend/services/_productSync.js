import Product from '../models/_product.js';
import { indexProduct } from './_elasticsearch.js';

const synchronizeProducts = async () => {
  try {
    const products = await Product.find();
    for (const product of products) {
      await indexProduct(product);
    }
    console.log("Products synchronized with Elasticsearch");
  } catch (err) {
    console.error("Error synchronizing products with Elasticsearch:", err);
  }
};

export default synchronizeProducts;
