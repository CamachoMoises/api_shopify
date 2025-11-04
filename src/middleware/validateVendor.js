// Validate vendor ID
const validateVendorId = (req, res, next) => {
  const vendorId = req.body.vendor_id;
  if (!vendorId) {
    return res.status(400).json({ success: false, error: 'Vendor ID is required' });
  }
  next();
};

// Validate product creation request
const validateProductCreation = (req, res, next) => {
  const { products } = req.body;
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, error: 'Products array is required and must not be empty' });
  }

  for (const product of products) {
    if (!product.title || !product.variants || !Array.isArray(product.variants) || product.variants.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each product must have a title and at least one variant' 
      });
    }

    for (const variant of product.variants) {
      if (!variant.price || !variant.sku) {
        return res.status(400).json({
          success: false,
          error: 'Each variant must have a price and SKU'
        });
      }
    }
  }
  next();
};

// Validate product update request
const validateProductUpdate = (req, res, next) => {
  const { updates } = req.body;
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ success: false, error: 'Updates array is required and must not be empty' });
  }

  for (const update of updates) {
    if (!update.shopify_product_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each update must have a shopify_product_id' 
      });
    }
  }
  next();
};

// Validate price update request
const validatePriceUpdate = (req, res, next) => {
  const { price_updates } = req.body;
  if (!price_updates || !Array.isArray(price_updates) || price_updates.length === 0) {
    return res.status(400).json({ success: false, error: 'Price updates array is required and must not be empty' });
  }

  for (const update of price_updates) {
    if (!update.shopify_variant_id || !update.new_price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each price update must have a shopify_variant_id and new_price' 
      });
    }
  }
  next();
};

// Validate inventory update request
const validateInventoryUpdate = (req, res, next) => {
  const { inventory_updates } = req.body;
  if (!inventory_updates || !Array.isArray(inventory_updates) || inventory_updates.length === 0) {
    return res.status(400).json({ success: false, error: 'Inventory updates array is required and must not be empty' });
  }

  for (const update of inventory_updates) {
    if (!update.shopify_location_id || !update.shopify_inventory_item_id || update.quantity === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each inventory update must have a shopify_location_id, shopify_inventory_item_id, and quantity' 
      });
    }
  }
  next();
};

// Validate product disable request
const validateProductDisable = (req, res, next) => {
  const { disable_requests } = req.body;
  if (!disable_requests || !Array.isArray(disable_requests) || disable_requests.length === 0) {
    return res.status(400).json({ success: false, error: 'Disable requests array is required and must not be empty' });
  }

  for (const request of disable_requests) {
    if (!request.shopify_product_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each disable request must have a shopify_product_id' 
      });
    }
  }
  next();
};

module.exports = {
  validateVendorId,
  validateProductCreation,
  validateProductUpdate,
  validatePriceUpdate,
  validateInventoryUpdate,
  validateProductDisable
}; 