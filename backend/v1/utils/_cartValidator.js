/**
 * Validates an array of cart products.
 * @param {Array} products - Array of products with productId and quantity
 * @returns {Object} - { valid: boolean, message?: string }
 */
export function validateCartProducts(products) {
  // Define constants directly in the file
  const MAX_PRODUCTS = 10; // Maximum number of products allowed in the cart
  const MIN_QUANTITY = 1; // Minimum quantity for a product

  // Validate constants
  if (!Number.isInteger(MAX_PRODUCTS) || MAX_PRODUCTS <= 0) {
    throw new Error("MAX_PRODUCTS must be a positive integer.");
  }
  if (!Number.isInteger(MIN_QUANTITY) || MIN_QUANTITY < 0) {
    throw new Error("MIN_QUANTITY must be a non-negative integer.");
  }

  // Check if products is an array
  if (!Array.isArray(products)) {
    return { valid: false, message: "Products must be an array." };
  }

  // Check for empty cart
  if (products.length === 0) {
    return { valid: false, message: "Cart cannot be empty." };
  }

  // Check maximum products
  if (products.length > MAX_PRODUCTS) {
    return { valid: false, message: `A cart cannot have more than ${MAX_PRODUCTS} products.` };
  }

  // Check for duplicate products
  const productIds = products.map((p, index) => {
    if (!p.productId) {
      return { invalid: true, index };
    }
    return p.productId.toString();
  });

  const invalidId = productIds.find((p) => p.invalid);
  if (invalidId) {
    return {
      valid: false,
      message: `Product at index ${invalidId.index} is missing a productId.`,
    };
  }

  const uniqueProductIds = new Set(productIds);
  if (uniqueProductIds.size !== productIds.length) {
    return { valid: false, message: "Duplicate products are not allowed in the cart." };
  }

  // Validate product format and quantity
  const invalidProduct = products.findIndex((p) => {
    // Validate productId as a 24-character hexadecimal string
    const isValidId =
      typeof p.productId === "string" && /^[0-9a-fA-F]{24}$/.test(p.productId);

    const isValidQuantity =
      typeof p.quantity === "number" &&
      Number.isInteger(p.quantity) &&
      p.quantity >= MIN_QUANTITY &&
      p.quantity > 0;

    return !isValidId || !isValidQuantity;
  });

  if (invalidProduct !== -1) {
    return {
      valid: false,
      message: `Invalid product at index ${invalidProduct}: productId or quantity is invalid.`,
    };
  }

  return { valid: true };
}