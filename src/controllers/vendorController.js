const { client } = require('../config/shopify');
const { createProducts, updateProducts, updatePrices, disableProducts } = require('./productController');
const { updateInventory } = require('./inventoryController');
const { createProductsGraphQL } = require('./productGraphQLController');

// Handle incoming product data from vendor
const handleVendorProducts = async (req, res) => {
  try {
    const vendorProducts = req.body.products;
    const vendorId = req.body.vendor_id;
    
    // Transform vendor product format to Shopify GraphQL format
    const shopifyProducts = vendorProducts.map(product => {
      // Transform images to include variant associations
      const transformedImages = product.images.map(img => ({
        url: img.url,
        alt: img.alt || "",
        position: img.position || 1,
        variant_ids: img.variant_ids || []
      }));

      return {
        title: product.title,
        description: product.description,
        vendor: vendorId,
        category: product.category,
        options: product.options || [],
        variants: product.variants,
        images: transformedImages,
        tags: product.tags || []
      };
    });

    // Call Shopify create products using GraphQL
    return await createProductsGraphQL({ body: { products: shopifyProducts } }, res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handle incoming product updates from vendor
const handleVendorProductUpdates = async (req, res) => {
  try {
    const vendorUpdates = req.body.updates;
    const vendorId = req.body.vendor_id;

    // Transform vendor updates to Shopify format
    const shopifyUpdates = vendorUpdates.map(update => ({
      id: update.shopify_product_id,
      title: update.name,
      description: update.description,
      vendor: vendorId,
      type: update.category,
      images: update.images.map(img => ({ src: img.url })),
      tags: update.tags.join(', ')
    }));

    // Call Shopify update products
    const result = await updateProducts({ body: { products: shopifyUpdates } }, res);
    return result;
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handle incoming price updates from vendor
const handleVendorPriceUpdates = async (req, res) => {
  try {
    const vendorPriceUpdates = req.body.price_updates;

    // Transform vendor price updates to Shopify format
    const shopifyPriceUpdates = vendorPriceUpdates.map(update => ({
      variant_id: update.shopify_variant_id,
      price: update.new_price.toString()
    }));

    // Call Shopify update prices
    const result = await updatePrices({ body: { updates: shopifyPriceUpdates } }, res);
    return result;
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handle incoming inventory updates from vendor
const handleVendorInventoryUpdates = async (req, res) => {
  try {
    const vendorInventoryUpdates = req.body.inventory_updates;

    // Transform vendor inventory updates to Shopify format
    const shopifyInventoryUpdates = vendorInventoryUpdates.map(update => ({
      location_id: update.shopify_location_id,
      inventory_item_id: update.shopify_inventory_item_id,
      quantity: parseInt(update.quantity, 10)
    }));

    // Call Shopify update inventory with the correct data structure
    const result = await updateInventory({ 
      body: { 
        updates: shopifyInventoryUpdates 
      } 
    }, res);

    if (!result) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update inventory' 
      });
    }

    return result;
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Handle product disable requests from vendor
const handleVendorProductDisable = async (req, res) => {
  try {
    const vendorDisableRequests = req.body.disable_requests;

    // Extract Shopify product IDs
    const shopifyProductIds = vendorDisableRequests.map(request => request.shopify_product_id);

    // Call Shopify disable products
    const result = await disableProducts({ body: { product_ids: shopifyProductIds } }, res);
    return result;
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  handleVendorProducts,
  handleVendorProductUpdates,
  handleVendorPriceUpdates,
  handleVendorInventoryUpdates,
  handleVendorProductDisable
}; 