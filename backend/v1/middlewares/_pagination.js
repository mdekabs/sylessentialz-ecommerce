/**
 * Constants for pagination parameters and default values.
 */
const PAGINATION_CONSTANTS = {
  PAGE_PARAM: "page",
  LIMIT_PARAM: "limit",
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12,
  MAX_LIMIT: 100, // To prevent excessive data fetching
};

/**
 * Generates pagination links based on current page, limit, and total items.
 * @param {number} page - Current page number.
 * @param {number} limit - Items per page.
 * @param {number} totalItems - Total items in the collection.
 * @param {string} baseUrl - Base URL for the request.
 * @returns {Object} Object containing pagination links.
 */
function generatePaginationLinks(page, limit, totalItems, baseUrl) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    first: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=1&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}`,
    prev: page > 1 ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page - 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null,
    self: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}`,
    next: page < totalPages ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page + 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null,
    last: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${totalPages}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}`,
  };
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

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || ''}`;

    res.locals.pagination = { page, limit, links: {}, hasMorePages: false };

    // Middleware will require `totalItems` to be set in the response locals in the route handler
    res.locals.setPagination = (totalItems) => {
      if (typeof totalItems !== 'number' || totalItems < 0) {
        logger.error('Invalid totalItems value in pagination middleware');
        return;
      }

      res.locals.pagination.links = generatePaginationLinks(page, limit, totalItems, baseUrl);
      res.locals.pagination.hasMorePages = page * limit < totalItems;
    };

    next();
  } catch (error) {
    logger.error(`Pagination Middleware Error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};
