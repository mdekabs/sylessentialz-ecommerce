import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const esClient = new Client({ node: process.env.ELASTICSEARCH_URI });

const indexProduct = async (product) => {
  await esClient.index({
    index: 'products',
    id: product._id.toString(),
    body: {
      title: product.title,
      description: product.description,
      image: product.image,
      categories: product.categories,
      size: product.size,
      color: product.color,
      price: product.price,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }
  });
};

const updateProduct = async (product) => {
  await esClient.update({
    index: 'products',
    id: product._id.toString(),
    body: {
      doc: {
        title: product.title,
        description: product.description,
        image: product.image,
        categories: product.categories,
        size: product.size,
        color: product.color,
        price: product.price,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    }
  });
};

const deleteProduct = async (productId) => {
  await esClient.delete({
    index: 'products',
    id: productId.toString()
  });
};

const searchProducts = async (query) => {
  const { body } = await esClient.search({
    index: 'products',
    body: {
      query: {
        multi_match: {
          query,
          fields: ['title', 'description', 'categories']
        }
      }
    }
  });
  return body.hits.hits;
};

export { indexProduct, updateProduct, deleteProduct, searchProducts };
