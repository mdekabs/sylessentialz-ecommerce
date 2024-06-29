import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
import Product from '../models/_product.js';

dotenv.config();

const esClient = new Client({ node: process.env.ELASTICSEARCH_URI });

const createProductIndex = async () => {
  const indexExists = await esClient.indices.exists({ index: 'products' });
  
  if (!indexExists) {
    await esClient.indices.create({
      index: 'products',
      body: {
        mappings: {
          properties: {
            title: { type: 'text' },
            description: { type: 'text' },
            image: { type: 'keyword' },
            categories: { type: 'keyword' },
            size: { type: 'keyword' },
            color: { type: 'keyword' },
            price: { type: 'float' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' }
          }
        }
      }
    });
    console.log("Products index created with mapping");
  }
};

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

const synchronizeProducts = async () => {
  try {
    await createProductIndex();
    
    const products = await Product.find();
    for (const product of products) {
      await indexProduct(product);
    }
    console.log("Products synchronized with Elasticsearch");
  } catch (err) {
    console.error("Error synchronizing products with Elasticsearch:", err);
  }
};

export { synchronizeProducts, indexProduct, updateProduct, deleteProduct, searchProducts };
