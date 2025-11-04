const { client, graphqlClient } = require('../config/shopify.js'); // Ajusta la ruta

const queryProducts = async (req, res) => {
  try {
    const { product_ids } = req.query;
    
    // Verificar si se proporcionaron IDs de productos
    if (!product_ids) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere al menos un ID de producto' 
      });
    }

    // Convertir la cadena de IDs en un array
    const productIds = product_ids.split(',').map(id => id.trim());
    
    if (productIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere al menos un ID de producto válido' 
      });
    }

    console.log('Consultando productos con IDs:', productIds);
    
    const results = [];
    
    // Si el cliente REST no está disponible, usar GraphQL
    if (!client) {
      console.log('Cliente REST no disponible, usando GraphQL');
      
      for (const productId of productIds) {
        try {
          const response = await graphqlClient.query({
            data: {
              query: `
                query getProduct($id: ID!) {
                  product(id: $id) {
                    id
                    legacyResourceId
                    title
                    descriptionHtml
                    vendor
                    productType
                    tags
                    status
                    createdAt
                    updatedAt
                    variants(first: 100) {
                      edges {
                        node {
                          id
                          legacyResourceId
                          title
                          price
                          sku
                          inventoryQuantity
                          barcode
                        
                          inventoryItem {
                            id
                            legacyResourceId
                          }
                          image {
                            id
                          }
                        }
                      }
                    }
                    images(first: 100) {
                      edges {
                        node {
                          id
                          url
                          altText
                        }
                      }
                    }
                    options {
                      id
                      name
                      values
                    }
                    metafields(first: 100) {
                      edges {
                        node {
                          id
                          namespace
                          key
                          value
                          type
                        }
                      }
                    }
                  }
                }
              `,
              variables: {
                id: `gid://shopify/Product/${productId}`
              }
            }
          });

          console.log(`Producto ${productId} consultado con éxito (GraphQL)`);
          
          // Transformar la respuesta de GraphQL a formato similar a REST
          const product = response.body.data.product;
          if (product) {
            const transformedProduct = {
              shopify_id: product.legacyResourceId,
              title: product.title,
              body_html: product.descriptionHtml,
              vendor: product.vendor,
              product_type: product.productType,
              tags: product.tags,
              status: product.status,
              shopify_created_at: product.createdAt,
              shopify_updated_at: product.updatedAt,
              variants: product.variants.edges.map(edge => ({
                shopify_variant_id: edge.node.legacyResourceId,
                title: edge.node.title,
                price: edge.node.price,
                sku: edge.node.sku,
                inventory_quantity: edge.node.inventoryQuantity,
                old_inventory_quantity: edge.node.inventoryQuantity, // Inicialmente igual
                barcode: edge.node.barcode,
                weight: edge.node.weight,
                weight_unit: edge.node.weightUnit,
                inventory_item_id: edge.node.inventoryItem?.legacyResourceId || null,
                image_id: edge.node.image?.url || null
              })),
              images: product.images.edges.map(edge => ({
                image_id: edge.node.url,
                src: edge.node.url,
                alt: edge.node.altText
              })),
              options: product.options,
              metafields: product.metafields.edges.map(edge => ({
                id: edge.node.id,
                namespace: edge.node.namespace,
                key: edge.node.key,
                value: edge.node.value,
                type: edge.node.type
              }))
            };
            results.push(transformedProduct);
          } else {
            results.push({
              shopify_id: productId,
              error: 'Producto no encontrado'
            });
          }
        } catch (productError) {
          console.error(`Error al consultar el producto ${productId}:`, productError);
          results.push({
            shopify_id: productId,
            error: `Error al consultar el producto: ${productError.message}`
          });
        }
      }
    } else {
      // Usar cliente REST si está disponible
      for (const productId of productIds) {
        try {
          const response = await client.get({
            path: `products/${productId}`,
          });

          console.log(`Producto ${productId} consultado con éxito (REST)`);
          
          // Transformar respuesta REST para usar los mismos nombres de campo
          const product = response.body.product;
          const transformedProduct = {
            shopify_id: product.id,
            title: product.title,
            body_html: product.body_html,
            vendor: product.vendor,
            product_type: product.product_type,
            tags: product.tags,
            status: product.status,
            shopify_created_at: product.created_at,
            shopify_updated_at: product.updated_at,
            variants: product.variants?.map(variant => ({
              shopify_variant_id: variant.id,
              title: variant.title,
              price: variant.price,
              sku: variant.sku,
              inventory_quantity: variant.inventory_quantity,
              old_inventory_quantity: variant.old_inventory_quantity || variant.inventory_quantity,
              barcode: variant.barcode,
              weight: variant.weight,
              weight_unit: variant.weight_unit,
              inventory_item_id: variant.inventory_item_id,
              image_id: variant.image_id
            })) || [],
            images: product.images?.map(image => ({
              image_id: image.id,
              src: image.src,
              alt: image.alt
            })) || [],
            options: product.options || [],
            metafields: product.metafields || []
          };
          
          results.push(transformedProduct);
        } catch (productError) {
          console.error(`Error al consultar el producto ${productId}:`, productError);
          results.push({
            shopify_id: productId,
            error: `Error al consultar el producto: ${productError.message}`
          });
        }
      }
    }

    return res.json({ 
      success: true, 
      count: results.length,
      products: results 
    });
  } catch (error) {
    console.error('Error al consultar productos:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};


module.exports = { queryProducts };