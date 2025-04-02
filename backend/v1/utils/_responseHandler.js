import HttpStatus from 'http-status-codes';

/**
 * Standardized response handler for Express routes.
 * Sends a JSON response with status code, type, message, and optional data.
 * @param {Object} res - Express response object
 * @param {number} httpCode - HTTP status code (e.g., 200, 404)
 * @param {string} type - Response type (e.g., 'success', 'error')
 * @param {string} message - Response message
 * @param {Object} [data={}] - Optional additional data to include
 * @returns {void} Sends JSON response to client
 */
const responseHandler = (res, httpCode, type, message, data = {}) => (
    res.status(httpCode).json({     // Set status and return JSON
        type,                       // Type of response
        message,                    // Descriptive message
        ...data                     // Spread additional data if provided
    })
);

export default responseHandler;
