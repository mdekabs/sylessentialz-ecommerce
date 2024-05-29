export const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "E-Commerce API",
      version: "1.0.0",
      description: "E-Commerce API documentation",
    },
    servers: [
      {
        url: "http://localhost:5000/api/v1",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "User ID",
            },
            username: {
              type: "string",
              description: "Username",
            },
            email: {
              type: "string",
              description: "User email",
            },
            password: {
              type: "string",
              description: "User password",
            },
            isAdmin: {
              type: "boolean",
              description: "Is the user an admin",
            },
          },
        },
        Product: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Product ID",
            },
            title: {
              type: "string",
              description: "Product title",
            },
            description: {
              type: "string",
              description: "Product description",
            },
            image: {
              type: "string",
              description: "Product image URL",
            },
            categories: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Product categories",
            },
            size: {
              type: "string",
              description: "Product size",
            },
            color: {
              type: "string",
              description: "Product color",
            },
            price: {
              type: "number",
              description: "Product price",
            },
          },
        },
        Cart: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Cart ID",
            },
            userId: {
              type: "string",
              description: "User ID",
            },
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: {
                    type: "string",
                    description: "Product ID",
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity of the product",
                  },
                },
              },
            },
          },
        },
        Order: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Order ID",
            },
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: {
                    type: "string",
                    description: "Product ID",
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity of the product",
                  },
                },
              },
            },
            amount: {
              type: "number",
              description: "Total amount of the order",
            },
            address: {
              type: "object",
              properties: {
                street: {
                  type: "string",
                  description: "Street address",
                },
                city: {
                  type: "string",
                  description: "City",
                },
                state: {
                  type: "string",
                  description: "State",
                },
                postalCode: {
                  type: "string",
                  description: "Postal code",
                },
                country: {
                  type: "string",
                  description: "Country",
                },
              },
            },
            status: {
              type: "string",
              description: "Order status",
              default: "pending",
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"],
};
