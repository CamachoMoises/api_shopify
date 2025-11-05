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
const handleVendorProductUpdates= async (req, res) => {
  const axios = require('axios');
  const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(/^https?:\/\//, '');
  
  // Configuración de rate limiting
  const REQUESTS_PER_SECOND = 35;
  const DELAY_BETWEEN_REQUESTS = Math.ceil(1000 / REQUESTS_PER_SECOND);
  const MAX_BATCH_SIZE = 50; // Límite recomendado para actualizaciones
  
  try {
    const { vendor_id, updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de updates con al menos un elemento'
      });
    }

    // Validar límite máximo
    if (updates.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `El número de actualizaciones (${updates.length}) excede el límite máximo (${MAX_BATCH_SIZE}). Por favor, divida la solicitud en lotes más pequeños.`,
        max_allowed: MAX_BATCH_SIZE,
        received: updates.length
      });
    }

    console.log(`\n=== ACTUALIZANDO PRODUCTOS ===`);
    console.log(`Vendor: ${vendor_id}`);
    console.log(`Total de actualizaciones: ${updates.length}`);

    const results = [];
    const errors = [];
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const { shopify_product_id, name, description, category, images, tags } = update;

      // Validar campo requerido
      if (!shopify_product_id) {
        errors.push({
          index: i,
          error: 'Falta el campo requerido: shopify_product_id'
        });
        continue;
      }

      try {
        console.log(`\n[${i + 1}/${updates.length}] Actualizando producto:`);
        console.log(`  - ID: ${shopify_product_id}`);
        console.log(`  - Nombre: ${name || 'sin cambios'}`);

        // Construir el objeto de actualización solo con campos proporcionados
        const productData = {
          product: {
            id: shopify_product_id
          }
        };

        // Agregar solo los campos que vienen en el update
        if (name !== undefined) {
          productData.product.title = name;
        }

        if (description !== undefined) {
          productData.product.body_html = description;
        }

        if (vendor_id !== undefined) {
          productData.product.vendor = vendor_id;
        }

        if (category !== undefined) {
          productData.product.product_type = category;
        }

        if (Array.isArray(tags)) {
          productData.product.tags = tags.join(', ');
        }

        // Actualizar producto usando REST API
        const updateUrl = `https://${shopUrl}/admin/api/2024-10/products/${shopify_product_id}.json`;
        
        const response = await axios.put(
          updateUrl,
          productData,
          {
            headers: {
              'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );

        const updatedProduct = response.data.product;

        // Si hay imágenes nuevas para agregar
        let addedImages = [];
        if (Array.isArray(images) && images.length > 0) {
          console.log(`  - Agregando ${images.length} imagen(es)...`);
          
          for (const img of images) {
            try {
              const imageData = {
                image: {
                  src: img.src || img.url || img.originalSource,
                  alt: img.alt || ''
                }
              };

              const imageUrl = `https://${shopUrl}/admin/api/2024-10/products/${shopify_product_id}/images.json`;
              const imageResp = await axios.post(imageUrl, imageData, {
                headers: {
                  'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
                  'Content-Type': 'application/json'
                }
              });

              addedImages.push(imageResp.data.image);
              await sleep(DELAY_BETWEEN_REQUESTS);
            } catch (imgError) {
              console.error(`    ✗ Error agregando imagen: ${imgError.message}`);
            }
          }
        }

        results.push({
          index: i,
          shopify_product_id,
          name: updatedProduct.title,
          success: true,
          updated_fields: {
            title: name !== undefined,
            description: description !== undefined,
            vendor: vendor_id !== undefined,
            category: category !== undefined,
            tags: Array.isArray(tags),
            images_added: addedImages.length
          },
          product: {
            id: updatedProduct.id,
            title: updatedProduct.title,
            vendor: updatedProduct.vendor,
            product_type: updatedProduct.product_type,
            tags: updatedProduct.tags,
            images_count: updatedProduct.images?.length || 0,
            variants_count: updatedProduct.variants?.length || 0
          }
        });

        console.log(`  ✓ Producto actualizado exitosamente`);

        // Rate limiting: esperar entre requests
        if (i < updates.length - 1) {
          await sleep(DELAY_BETWEEN_REQUESTS);
        }

      } catch (updateError) {
        // Manejar rate limiting
        if (updateError.response?.status === 429) {
          console.error(`  ✗ Rate limit alcanzado, esperando...`);
          const retryAfter = parseInt(updateError.response.headers['retry-after'] || '2') * 1000;
          await sleep(retryAfter);
          i--; // Reintentar
          continue;
        }

        console.error(`  ✗ Error:`, updateError.response?.data || updateError.message);
        
        errors.push({
          index: i,
          shopify_product_id,
          name,
          error: updateError.response?.data?.errors || updateError.message,
          details: updateError.response?.data
        });
      }
    }

    console.log(`\n=== RESUMEN ===`);
    console.log(`✓ Exitosos: ${results.length}`);
    console.log(`✗ Errores: ${errors.length}`);

    const statusCode = errors.length > 0 
      ? (results.length > 0 ? 207 : 400)
      : 200;

    return res.status(statusCode).json({
      success: errors.length === 0,
      vendor_id,
      total: updates.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('\n=== ERROR GENERAL ===');
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

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