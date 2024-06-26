# Sylessentialz E-Commerce API

This is a RESTful API for managing an e-commerce platform. It includes functionalities for user authentication, product management, order processing, and more.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)

## Installation

1. **Clone the repository**:
    ```sh
    git clone https://github.com/yourusername/sylessentialz-ecommerce.git
    cd sylessentialz-ecommerce
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

3. **Set up environment variables**:
    Create a `.env` file in the root directory and add your environment variables as needed (e.g., database connection strings, JWT secret).

    Example `.env` file:
    ```env
    PORT=5000
    DB_CONNECTION_STRING=mongodb://localhost:27017/sylessentialz
    JWT_SECRET=your_jwt_secret
    ELASTICSEARCH_HOST=localhost:9200
    ```

4. **Start the server**:
    ```sh
    npm start
    ```

## Usage

### Swagger Documentation

You can access the API documentation and interact with the API using Swagger UI at `http://localhost:5000/api-docs` and query the routes see how it works.


