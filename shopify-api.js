require('dotenv').config();
const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
const express = require('express');

const app = express();
app.use(express.json());

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products', 'read_orders', 'write_orders'],
  hostName: process.env.SHOPIFY_SHOP_URL,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});

const client = new shopify.clients.Rest({
  session: {
    shop: process.env.SHOPIFY_SHOP_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  },
});

// Create products in bulk
app.post('/api/products/bulk', async (req, res) => {
  try {
    const products = req.body.products;
    const createdProducts = [];

    for (const product of products) {
      const response = await client.post({
        path: 'products',
        data: {
          product: {
            title: product.title,
            body_html: product.description,
            vendor: product.vendor,
            product_type: product.type,
            variants: product.variants,
            images: product.images,
          },
        },
      });

      createdProducts.push(response.body.product);
    }

    res.json({ success: true, products: createdProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update inventory in bulk
app.put('/api/inventory/bulk', async (req, res) => {
  try {
    const inventoryUpdates = req.body.updates;
    const results = [];

    for (const update of inventoryUpdates) {
      const response = await client.put({
        path: `inventory_levels/set`,
        data: {
          location_id: update.location_id,
          inventory_item_id: update.inventory_item_id,
          available: update.quantity,
        },
      });

      results.push(response.body);
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product metadata
app.put('/api/products/:id/metadata', async (req, res) => {
  try {
    const productId = req.params.id;
    const metadata = req.body.metadata;

    const response = await client.put({
      path: `products/${productId}`,
      data: {
        product: {
          id: productId,
          metafields: metadata,
        },
      },
    });

    res.json({ success: true, product: response.body.product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get orders
app.get('/api/orders', async (req, res) => {
  try {
    const response = await client.get({
      path: 'orders',
      query: {
        status: req.query.status || 'any',
        limit: req.query.limit || 50,
      },
    });

    res.json({ success: true, orders: response.body.orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 