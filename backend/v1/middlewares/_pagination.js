import { logger } from "../config/_logger.js";
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";

/**
 * Constants for pagination parameters and default values.
 */
const PAGINATION_CONSTANTS = {
  PAGE_PARAM: "page",
  LIMIT_PARAM: "limit",
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12,
  MAX_LIMIT: 100, // Prevent excessive data fetching
};

/**
 * Generates HATEOAS-style pagination links for navigation.
 * @param {number} page - Current page number
 * @param {number} limit - Number of items per page
 * @param {number} totalItems - Total number of items in the collection
 * @param {string} baseUrl - Base URL for constructing links
 * @returns {Array<Object>} Array of pagination link objects with "rel" and "href" properties
 */
function generatePaginationLinks(page, limit, totalItems, baseUrl) {
  const totalPages = Math.ceil(totalItems / limit);

  return [
    { rel: "first", href: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=1&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` },
    { rel: "prev", href: page > 1 ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page - 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null },
    { rel: "self", href: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` },
    { rel: "next", href: page < totalPages ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page + 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null },
    { rel: "last", href: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${totalPages}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` },
  ].filter(link => link.href !== null); // Remove links with null href
}

/**
 * Validates and sanitizes pagination parameters from query strings.
 * @param {string|number} page - Raw page number from request query
 * @param {string|number} limit - Raw limit value from request query
 * @returns {Object} Object containing sanitized page and limit values
 */
function sanitizePaginationParams(page, limit) {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  return {
    page: isNaN(parsedPage) || parsedPage < 1 ? PAGINATION_CONSTANTS.DEFAULT_PAGE : parsedPage,
    limit: isNaN(parsedLimit) || parsedLimit < 1 ? PAGINATION_CONSTANTS.DEFAULT_LIMIT : Math.min(parsedLimit, PAGINATION_CONSTANTS.MAX_LIMIT),
  };
}

/**
 * Middleware to handle pagination for Express routes.
 * Sets up pagination data in res.locals and provides a method to set total items.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
export const pagination = (req, res, next) => {
  try {
    // Sanitize pagination parameters from query
    const { page, limit } = sanitizePaginationParams(
      req.query[PAGINATION_CONSTANTS.PAGE_PARAM],
      req.query[PAGINATION_CONSTANTS.LIMIT_PARAM]
    );

    // Construct base URL for pagination links
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl || ""}`;

    // Initialize pagination object in res.locals
    res.locals.pagination = { page, limit, links: [], hasMorePages: false };

    /**
     * Sets total items and generates pagination links.
     * Must be called in route handlers after determining totalItems.
     * @param {number} totalItems - Total number of items in the dataset
     */
    res.locals.setPagination = (totalItems) => {
      if (typeof totalItems !== "number" || totalItems < 0) {
        logger.error("Invalid totalItems value in pagination middleware");
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Invalid totalItems value");
      }

      res.locals.pagination.links = generatePaginationLinks(page, limit, totalItems, baseUrl);
      res.locals.pagination.hasMorePages = page * limit < totalItems;
    };

    next();
  } catch (error) {
    logger.error(`Pagination Middleware Error: ${error.message}`);
    return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Internal server error");
  }
};