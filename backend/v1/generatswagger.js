import swaggerJsdoc from 'swagger-jsdoc';
import { writeFileSync } from 'fs';
import { stringify } from 'yaml';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'Auto-generated from JSDoc comments',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
writeFileSync('./openapi.yaml', stringify(swaggerSpec));
console.log('✅ openapi.yaml generated successfully!');