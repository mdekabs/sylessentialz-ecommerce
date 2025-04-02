export const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "E-Commerce API",
      version: "1.0.0",
      description: "API documentation for an e-commerce platform with user management, products, carts, orders, payments, and shipping.",
    },
    servers: [
      {
        url: "http://localhost:5000/api/v1", // Matches typical development server setup
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        accessToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT", // Matches JWT usage in AuthController
          description: "JWT token required for authenticated endpoints",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for the user",
              example: "507f1f77bcf86cd799439011",
            },
            username: {
              type: "string",
              description: "User's username",
              example: "john_doe",
            },
            email: {
              type: "string",
              description: "User's email address",
              example: "john.doe@example.com",
            },
            password: {
              type: "string",
              description: "User's hashed password (excluded in responses)",
              example: "$2a$10$...",
            },
            isAdmin: {
              type: "boolean",
              description: "Indicates if the user has admin privileges",
              example: false,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "User creation timestamp",
              example: "2025-04-02T12:00:00Z",
            },
            lockUntil: {
              type: "string",
              format: "date-time",
              description: "Timestamp until which the account is locked due to login attempts",
              example: null,
            },
          },
          required: ["username", "email", "password"],
        },
        Product: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for the product",
              example: "507f1f77bcf86cd799439012",
            },
            name: { // Changed from 'title' to match ProductController
              type: "string",
              description: "Name of the product",
              example: "Wireless Mouse",
            },
            description: {
              type: "string",
              description: "Description of the product",
              example: "A high-precision wireless mouse",
            },
            image: {
              type: "string",
              description: "URL to the product image",
              example: "http://example.com/images/mouse.jpg",
            },
            category: { // Changed from 'categories' (array) to 'category' (string) to match ProductController
              type: "string",
              description: "Category of the product",
              example: "Electronics",
            },
            price: {
              type: "number",
              description: "Price of the product",
              example: 29.99,
            },
            stock: { // Added to align with CartController and Product model usage
              type: "number",
              description: "Available stock quantity",
              example: 100,
            },
            version: { // Added for optimistic locking from ProductController
              type: "number",
              description: "Version number for concurrency control",
              example: 0,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Product creation timestamp",
              example: "2025-04-02T12:00:00Z",
            },
          },
          required: ["name", "description", "price", "category", "stock"],
        },
        Cart: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for the cart",
              example: "507f1f77bcf86cd799439013",
            },
            userId: {
              type: "string",
              description: "ID of the user owning the cart (optional for guests)",
              example: "507f1f77bcf86cd799439011",
            },
            guestId: { // Added to support guest carts from CartController
              type: "string",
              description: "Unique identifier for guest carts",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: {
                    type: "string",
                    description: "ID of the product in the cart",
                    example: "507f1f77bcf86cd799439012",
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity of the product",
                    example: 2,
                  },
                },
                required: ["productId", "quantity"],
              },
              description: "List of products in the cart",
            },
            lastUpdated: { // Added from CartController for expiration logic
              type: "string",
              format: "date-time",
              description: "Timestamp of the last cart update",
              example: "2025-04-02T12:00:00Z",
            },
            version: { // Added for optimistic locking from CartController
              type: "number",
              description: "Version number for concurrency control",
              example: 0,
            },
          },
          required: ["products"],
        },
        Order: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for the order",
              example: "507f1f77bcf86cd799439014",
            },
            userId: { // Added from OrderController
              type: "string",
              description: "ID of the user who placed the order",
              example: "507f1f77bcf86cd799439011",
            },
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: {
                    type: "string",
                    description: "ID of the product in the order",
                    example: "507f1f77bcf86cd799439012",
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity of the product",
                    example: 2,
                  },
                },
                required: ["productId", "quantity"],
              },
              description: "List of products in the order",
            },
            amount: {
              type: "number",
              description: "Total payable amount after store credit and shipping",
              example: 59.98,
            },
            address: {
              type: "object",
              properties: {
                street: {
                  type: "string",
                  description: "Street address",
                  example: "123 Main St",
                },
                city: {
                  type: "string",
                  description: "City",
                  example: "Springfield",
                },
                state: {
                  type: "string",
                  description: "State",
                  example: "IL",
                },
                postalCode: {
                  type: "string",
                  description: "Postal code",
                  example: "62701",
                },
                country: {
                  type: "string",
                  description: "Country",
                  example: "USA",
                },
              },
              required: ["street", "city", "state", "postalCode", "country"],
              description: "Shipping address for the order",
            },
            status: {
              type: "string",
              description: "Current status of the order",
              enum: ["pending", "processing", "shipped", "delivered", "cancelled"], // From OrderController
              default: "pending",
              example: "pending",
            },
            version: { // Added for optimistic locking from OrderController
              type: "number",
              description: "Version number for concurrency control",
              example: 0,
            },
            createdAt: { // Added to align with sorting in OrderController
              type: "string",
              format: "date-time",
              description: "Order creation timestamp",
              example: "2025-04-02T12:00:00Z",
            },
          },
          required: ["userId", "products", "amount", "address", "status"],
        },
        StoreCredit: { // Added to align with OrderController
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for the store credit",
              example: "507f1f77bcf86cd799439015",
            },
            userId: {
              type: "string",
              description: "ID of the user owning the credit",
              example: "507f1f77bcf86cd799439011",
            },
            amount: {
              type: "number",
              description: "Amount of store credit",
              example: 10.00,
            },
            expiryDate: {
              type: "string",
              format: "date-time",
              description: "Expiration date of the store credit",
              example: "2025-07-02T12:00:00Z",
            },
            version: { // Added for optimistic locking from OrderController
              type: "number",
              description: "Version number for concurrency control",
              example: 0,
            },
          },
          required: ["userId", "amount", "expiryDate"],
        },
        Shipping: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for the shipping record",
              example: "507f1f77bcf86cd799439016",
            },
            orderId: {
              type: "string",
              description: "ID of the associated order",
              example: "507f1f77bcf86cd799439014",
            },
            trackingNumber: {
              type: "string",
              description: "Tracking number for the shipment",
              example: "DHL-550e8400-e29b-41d4-a716-446655440000",
            },
            carrier: {
              type: "string",
              description: "Shipping carrier",
              example: "DHL",
            },
            estimatedDeliveryDate: {
              type: "string",
              format: "date-time",
              description: "Estimated delivery date",
              example: "2025-04-03T12:00:00Z",
            },
          },
          required: ["orderId", "trackingNumber", "carrier", "estimatedDeliveryDate"],
        },
        Payment: { // Added to align with PaymentController
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "ID of the order being paid",
              example: "507f1f77bcf86cd799439014",
            },
            amount: {
              type: "number",
              description: "Amount charged in cents",
              example: 5998,
            },
            currency: {
              type: "string",
              description: "Currency of the payment",
              example: "usd",
            },
            status: {
              type: "string",
              description: "Payment status",
              enum: ["pending", "paid"],
              example: "paid",
            },
            chargeId: {
              type: "string",
              description: "Stripe charge ID",
              example: "ch_1J5X7K2eZvKYlo2C5X5X5X5X",
            },
          },
          required: ["orderId", "amount", "currency", "status"],
        },
        Search: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for products",
              example: "wireless mouse",
            },
          },
          required: ["query"],
        },
      },
    },
    security: [
      {
        accessToken: [], // Applies JWT authentication globally where required
      },
    ],
  },
  apis: ["./routes/*.js"], // Assumes route files are in a 'routes' directory
};
