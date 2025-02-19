/**
 * Constants for pagination parameters and default values.
 */
const PAGINATION_CONSTANTS = {
  PAGE_PARAM: "page",
  LIMIT_PARAM: "limit",
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12,
  MAX_LIMIT: 100, // Added to cap the limit for performance
};

/**
 * Generates pagination links based on the current page and limit.
 * @param {number} page - Current page number.
 * @param {number} limit - Number of items per page.
 * @param {string} baseUrl - Base URL for the request (optional).
 * @returns {Object} Object containing pagination links.
 */
function generatePaginationLinks(page, limit, baseUrl = '') {
  const links = {
    first: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${PAGINATION_CONSTANTS.DEFAULT_PAGE}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}`,
    prev: page > PAGINATION_CONSTANTS.DEFAULT_PAGE ? `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page - 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}` : null,
    self: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}`,
    next: `${baseUrl}?${PAGINATION_CONSTANTS.PAGE_PARAM}=${page + 1}&${PAGINATION_CONSTANTS.LIMIT_PARAM}=${limit}`,
  };

  return Object.fromEntries(
    Object.entries(links).filter(([_, value]) => value !== null)
  );
}

/**
 * Validates and sanitizes pagination parameters.
 * @param {string|number} page - Page number from query.
 * @param {string|number} limit - Limit from query.
 * @returns {Object} Sanitized page and limit values.
 */
function sanitizePaginationParams(page, limit) {
  const parsedPage = Math.max(parseInt(page, 10) || PAGINATION_CONSTANTS.DEFAULT_PAGE, PAGINATION_CONSTANTS.DEFAULT_PAGE);
  const parsedLimit = Math.min(
    Math.max(parseInt(limit, 10) || PAGINATION_CONSTANTS.DEFAULT_LIMIT, 1),
    PAGINATION_CONSTANTS.MAX_LIMIT
  );
  return { page: parsedPage, limit: parsedLimit };
}

/**
 * Express middleware for handling pagination.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Next middleware function.
 */
function Pagination(req, res, next) {
  try {
    const { page, limit } = sanitizePaginationParams(
      req.query[PAGINATION_CONSTANTS.PAGE_PARAM],
      req.query[PAGINATION_CONSTANTS.LIMIT_PARAM]
    );

    // Extract base URL from request (optional improvement)
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || ''}`;

    const pagination = {
      page,
      limit,
      links: generatePaginationLinks(page, limit, baseUrl),
    };

    // `hasMorePages` could be determined later by the route handler based on actual data
    pagination.hasMorePages = true; // Placeholder, adjust based on data in the route

    res.locals.pagination = pagination;
    next();
  } catch (error) {
    // Log the error for debugging (in a production environment, use a logger)
    console.error('Pagination Middleware Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default Pagination;
