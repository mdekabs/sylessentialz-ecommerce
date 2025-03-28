E-Commerce Platform
A robust, scalable e-commerce backend built with Node.js, Express, MongoDB, Elasticsearch, Redis, and Stripe. This platform supports user authentication, product management with advanced search, cart operations, order processing with store credit, payment integration, and income tracking, enhanced by HATEOAS-compliant pagination and caching.
Features
User Management:
Register/login with JWT authentication.

User profile management with role-based access (user/admin).
Product Management:
CRUD operations for products (admin).

Advanced product search via Elasticsearch.
Cart Operations:
Add/remove products to/from cart.

View cart contents.
Order Management:
Create orders from cart with bulk querying.

Paginated order retrieval (user/all) with HATEOAS links.

Update order status (admin).

Cancel orders with soft deletion and store credit issuance.
Store Credit:
Apply store credit atomically during checkout.

Issue store credit on cancellation with 90-day expiry.

Retrieve user store credit balance.
Payment Processing:
Process payments for pending orders via Stripe.

Generate shipments with DHL tracking upon payment.
Income Tracking:
Calculate income from active orders and redeemed store credit.
Search & Performance:
Elasticsearch for fast, full-text product search.

Redis for caching (e.g., sessions, frequently accessed data).
API Design:
HATEOAS-compliant pagination for navigational ease.

Swagger documentation for API exploration.
Tech Stack
Node.js: v16.x+

Express: API framework

MongoDB: Primary database

Mongoose: MongoDB ODM

Elasticsearch: Product search engine

Redis: Caching/session management

Stripe: Payment processing

JWT: Authentication

UUID: Unique identifiers

Swagger: API documentation

Winston: Logging

dotenv: Environment variables
Prerequisites
Node.js and npm

MongoDB (local or cloud, e.g., Atlas)

Elasticsearch (v7.x or v8.x)

Redis (v6.x+)

Stripe account (test keys)
Installation
Clone the Repository
bash
git clone <repository-url>
cd ecommerce-platform
Install Dependencies
bash
npm install

Key packages:
express, mongoose, stripe, elasticsearch, redis, jsonwebtoken, uuid, swagger-ui-express, swagger-jsdoc, winston, cors, body-parser, express-async-handler, dotenv
Set Up Environment Variables
Create .env:
bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ecommerce
ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379
STRIPE_KEY=sk_test_your_stripe_secret_key
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

Update ELASTICSEARCH_URL and REDIS_URL if using remote instances.
Run Dependencies
MongoDB: mongod

Elasticsearch: elasticsearch

Redis: redis-server
Start the Application
bash
npm start

Server runs at http://localhost:3000.

Swagger docs at http://localhost:3000/api-docs.

API Endpoints (HATEOAS-Enabled)
Health Check
GET /api/v1/health

Response: 200 OK
json
{
  "status": "ok",
  "database": "connected",
  "elasticsearch": "connected"
}
Authentication
Register
POST /api/v1/auth/register

Body: {"username": "user", "password": "pass", "email": "user@example.com"}

Response: 201 Created
json
{
  "type": "success",
  "message": "User registered",
  "user": { "id": "123", "username": "user", "role": "user" },
  "token": "jwt_token"
}
Login
POST /api/v1/auth/login

Body: {"email": "user@example.com", "password": "pass"}

Response: 200 OK
json
{
  "type": "success",
  "message": "Login successful",
  "token": "jwt_token"
}
Users
Get Profile
GET /api/v1/users/me

Headers: Authorization: Bearer <user-token>

Response: 200 OK
json
{
  "type": "success",
  "message": "User retrieved",
  "user": { "id": "123", "username": "user", "email": "user@example.com" }
}
Products
Create Product (Admin)
POST /api/v1/products

Headers: Authorization: Bearer <admin-token>, Content-Type: application/json

Body: {"name": "Shirt", "price": 20, "stock": 100}

Response: 201 Created
json
{
  "type": "success",
  "message": "Product created",
  "product": { "id": "67e51e9c4b575b2df063121c", "name": "Shirt", "price": 20 }
}
Search Products
GET /api/v1/products/search?q=shirt&page=1&limit=10

Response: 200 OK (HATEOAS)
json
{
  "type": "success",
  "message": "Products retrieved",
  "products": [{ "id": "67e51e9c4b575b2df063121c", "name": "Shirt", "price": 20 }],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1,
    "hasMorePages": false,
    "links": {
      "first": "/api/v1/products/search?q=shirt&page=1&limit=10",
      "last": "/api/v1/products/search?q=shirt&page=1&limit=10",
      "previous": null,
      "next": null
    }
  }
}
Cart
Add to Cart
POST /api/v1/carts

Headers: Authorization: Bearer <user-token>, Content-Type: application/json

Body: {"productId": "67e51e9c4b575b2df063121c", "quantity": 2}

Response: 200 OK
json
{
  "type": "success",
  "message": "Product added to cart",
  "cart": { "userId": "123", "products": [{"productId": "67e51e9c4b575b2df063121c", "quantity": 2}] }
}
Get Cart
GET /api/v1/carts

Headers: Authorization: Bearer <user-token>

Response: 200 OK
json
{
  "type": "success",
  "message": "Cart retrieved",
  "cart": { "userId": "123", "products": [{"productId": "67e51e9c4b575b2df063121c", "quantity": 2}] }
}
Orders
Create Order
POST /api/v1/orders

Headers: Authorization: Bearer <user-token>, Content-Type: application/json

Body: {"address": {"street": "123 Main St"}}

Response: 201 Created
json
{
  "type": "success",
  "message": "Order placed",
  "order": { "id": "67e57a3bfc2g903ad4615d3d", "amount": 42, "status": "pending" }
}
Get User Orders
GET /api/v1/orders?page=1&limit=10

Headers: Authorization: Bearer <user-token>

Response: 200 OK (HATEOAS)
json
{
  "type": "success",
  "message": "Orders retrieved",
  "orders": [{ "id": "67e57a3bfc2g903ad4615d3d", "amount": 42, "status": "pending" }],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1,
    "hasMorePages": false,
    "links": {
      "first": "/api/v1/orders?page=1&limit=10",
      "last": "/api/v1/orders?page=1&limit=10",
      "previous": null,
      "next": null
    }
  }
}
Get All Orders (Admin)
GET /api/v1/orders/all?page=1&limit=10

Headers: Authorization: Bearer <admin-token>

Response: 200 OK (HATEOAS, similar to above).
Update Order Status (Admin)
PUT /api/v1/orders/:orderId/status

Headers: Authorization: Bearer <admin-token>, Content-Type: application/json

Body: {"status": "shipped"}

Response: 200 OK
json
{
  "type": "success",
  "message": "Order status updated",
  "order": { "id": "67e57a3bfc2g903ad4615d3d", "status": "shipped" }
}
Cancel Order (Admin)
POST /api/v1/orders/cancel/:orderId

Headers: Authorization: Bearer <admin-token>, Content-Type: application/json

Body: {}

Response: 200 OK
json
{
  "type": "success",
  "message": "Order cancelled and store credit issued",
  "orderId": "67e57a3bfc2g903ad4615d3d",
  "storeCredit": { "amount": 42, "expiryDate": "2025-06-25" }
}
Store Credit
Get Store Credit
GET /api/v1/orders/store-credit

Headers: Authorization: Bearer <user-token>

Response: 200 OK
json
{
  "type": "success",
  "message": "Store credit retrieved",
  "storeCredit": { "amount": 42, "expiryDate": "2025-06-25" }
}
Income
Get Total Income (Admin)
GET /api/v1/orders/income

Headers: Authorization: Bearer <admin-token>

Response: 200 OK
json
{
  "type": "success",
  "message": "Total income calculated",
  "totalIncome": 62,
  "breakdown": {
    "activeOrderIncome": 20,
    "redeemedStoreCredit": 42,
    "issuedStoreCredit": 42
  }
}
Payments
Create Payment
POST /api/v1/orders/payments

Headers: Authorization: Bearer <user-token>, Content-Type: application/json

Body: {"tokenId": "tok_visa"}

Response: 200 OK
json
{
  "type": "success",
  "message": "Payment processed and shipment created",
  "order": { "id": "67e57a3bfc2g903ad4615d3d", "status": "paid" },
  "charge": { "id": "ch_3P8XyZ1234567890", "amount": 4200 },
  "shipment": { "trackingNumber": "DHL-550e8400-e29b-41d4-a716-446655440000" }
}
Testing with Stripe
Setup
Secret Key: sk_test_... in .env.

Publishable Key: pk_test_... for client-side.
Test Tokens
tok_visa: Successful payment.

tok_chargeDeclined: Declined payment.
Test Flow
Register/Login:
bash
curl -X POST "http://localhost:3000/api/v1/auth/register" \
-H "Content-Type: application/json" \
-d '{"username": "test", "password": "pass123", "email": "test@example.com"}'
Search & Add to Cart:
bash
curl -X POST "http://localhost:3000/api/v1/carts" \
-H "Authorization: Bearer <user-token>" \
-H "Content-Type: application/json" \
-d '{"productId": "67e51e9c4b575b2df063121c", "quantity": 2}'
Create Order:
bash
curl -X POST "http://localhost:3000/api/v1/orders" \
-H "Authorization: Bearer <user-token>" \
-H "Content-Type: application/json" \
-d '{"address": {"street": "123 Main St"}}'
Process Payment:
bash
curl -X POST "http://localhost:3000/api/v1/orders/payments" \
-H "Authorization: Bearer <user-token>" \
-H "Content-Type: application/json" \
-d '{"tokenId": "tok_visa"}'
Check Income:
bash
curl -X GET "http://localhost:3000/api/v1/orders/income" \
-H "Authorization: Bearer <admin-token>"

Elasticsearch Integration
Purpose: Full-text search for products.

Sync: syncProducts ensures MongoDB product data is indexed in Elasticsearch.

Endpoint: /api/v1/products/search?q=<query>.
Redis Integration
Purpose: Likely used for caching (e.g., session data, product listings) or rate limiting.

Configuration: Connects via REDIS_URL.
Optimizations
Elasticsearch: Fast product search.

Redis: Reduced database load via caching.

HATEOAS: Navigable API responses.

Bulk Querying: In orderController.create_order.

Atomic Updates: Store credit operations.

Soft Deletion: Orders preserved with cancelled status.

Contributing
Fork the repo.

Branch: git checkout -b feature-name.

Commit: git commit -m "Add feature".

Push: git push origin feature-name.

Submit PR.

