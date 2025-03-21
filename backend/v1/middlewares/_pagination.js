import { logger } from "../middlewares/index.js";
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
 * Generates HATEOAS-style pagination links.
 * @param {number} page - Current page number.
 * @param {number} limit - Items per page.
 * @param {number} totalItems - Total items in the collection.
 * @param {string} baseUrl - Base URL for the request.
 * @returns {Array} Array containing pagination links with "rel" attributes.
 */
function generatePaginationLinks(page, limit, totalItems, baseUrl) {
  const totalPages = Math.ceil(totalItems / limit);

  return [
    { rel: "first", href: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=1&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` },
    { rel: "prev", href: page > 1 ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page - 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null },
    { rel: "self", href: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` },
    { rel: "next", href: page < totalPages ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page + 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null },
    { rel: "last", href: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${totalPages}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` },
  ].filter(link => link.href !== null); // Remove null links
}

/**
 * Validates and sanitizes pagination parameters.
 * @param {string|number} page - Page number from query.
 * @param {string|number} limit - Limit from query.
 * @returns {Object} Sanitized page and limit values.
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
 * Express middleware for handling pagination.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Next middleware function.
 */
export const pagination = (req, res, next) => {
  try {
    const { page, limit } = sanitizePaginationParams(
      req.query[PAGINATION_CONSTANTS.PAGE_PARAM],
      req.query[PAGINATION_CONSTANTS.LIMIT_PARAM]
    );

    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl || ""}`;

    res.locals.pagination = { page, limit, links: [], hasMorePages: false };

    // Middleware will require `totalItems` to be set in the response locals in the route handler
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
