const { client } = require('../config/shopify');

// Create products in bulk
const createProducts = async (req, res) => {
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
            tags: product.tags,
            status: 'active'
          },
        },
      });

      createdProducts.push(response.body.product);
    }

    res.json({ success: true, products: createdProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update products in bulk
const updateProducts = async (req, res) => {
  try {
    const products = req.body.products;
    const updatedProducts = [];

    for (const product of products) {
      const response = await client.put({
        path: `products/${product.id}`,
        data: {
          product: {
            id: product.id,
            title: product.title,
            body_html: product.description,
            vendor: product.vendor,
            product_type: product.type,
            images: product.images,
            tags: product.tags
          },
        },
      });

      updatedProducts.push(response.body.product);
    }

    res.json({ success: true, products: updatedProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update prices in bulk
const updatePrices = async (req, res) => {
  try {
    const updates = req.body.updates;
    const results = [];

    for (const update of updates) {
      const response = await client.put({
        path: `variants/${update.variant_id}`,
        data: {
          variant: {
            id: update.variant_id,
            price: update.price
          },
        },
      });

      results.push(response.body.variant);
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Disable products in bulk
const disableProducts = async (req, res) => {
  try {
    const productIds = req.body.product_ids;
    const results = [];

    for (const productId of productIds) {
      const response = await client.put({
        path: `products/${productId}`,
        data: {
          product: {
            id: productId,
            status: 'archived'
          },
        },
      });

      results.push(response.body.product);
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create new variant for a product
const createVariant = async (req, res) => {
  try {
    const { product_id, variant, images } = req.body;

    if (!product_id || !variant) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere product_id y variant' 
      });
    }

    // Primero obtener el producto para verificar su configuración actual
    let productResponse;
    try {
      productResponse = await client.get({
        path: `products/${product_id}`,
        query: {
          fields: 'id,title,variants,options'
        }
      });
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'Producto no encontrado' 
      });
    }

    const product = productResponse.body.product;
    const existingVariants = product.variants || [];
    const existingOptions = product.options || [];

    // Verificar si existe una variante "Default Title" que necesite ser eliminada
    const defaultTitleVariant = existingVariants.find(variant => {
      return variant.option1 === 'Default Title' || 
             (variant.options && variant.options.some(opt => opt.name === 'Title' && opt.value === 'Default Title'));
    });

    if (defaultTitleVariant) {
      console.log('Encontrada variante "Default Title", eliminándola antes de crear nuevas variantes...');
      
      try {
        await client.delete({
          path: `variants/${defaultTitleVariant.id}`
        });
        
        console.log('Variante Default Title eliminada exitosamente');
        
        // Esperar un momento para que Shopify procese la eliminación
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Actualizar la lista de variantes existentes
        const updatedProductResponse = await client.get({
          path: `products/${product_id}`,
          query: {
            fields: 'id,title,variants,options'
          }
        });
        
        const updatedProduct = updatedProductResponse.body.product;
        const updatedExistingVariants = updatedProduct.variants || [];
        const updatedExistingOptions = updatedProduct.options || [];
        
        console.log('Producto actualizado después de eliminar Default Title:', {
          variantsCount: updatedExistingVariants.length,
          options: updatedExistingOptions
        });
        
      } catch (deleteError) {
        console.error('Error eliminando variante Default Title:', deleteError);
        return res.status(500).json({ 
          success: false, 
          error: `Error eliminando variante Default Title: ${deleteError.message}` 
        });
      }
    }

    // Si el producto no tiene variantes, necesitamos configurar las opciones primero
    if (existingVariants.length === 0 || (defaultTitleVariant && existingVariants.length === 1)) {
      console.log('Producto sin variantes, configurando opciones...');
      
      // Determinar las opciones necesarias basándose en la variante que se va a crear
      const requiredOptions = [];
      
      if (variant.option1) {
        requiredOptions.push({
          name: 'Option 1',
          values: [variant.option1]
        });
      }
      
      if (variant.option2) {
        requiredOptions.push({
          name: 'Option 2', 
          values: [variant.option2]
        });
      }
      
      if (variant.option3) {
        requiredOptions.push({
          name: 'Option 3',
          values: [variant.option3]
        });
      }

      // Si no hay opciones configuradas, configurarlas
      if (existingOptions.length === 0 && requiredOptions.length > 0) {
        console.log('Configurando opciones del producto:', requiredOptions);
        
        try {
          await client.put({
            path: `products/${product_id}`,
            data: {
              product: {
                id: product_id,
                options: requiredOptions
              }
            }
          });
          
          console.log('Opciones del producto configuradas exitosamente');
          
          // Esperar un momento para que las opciones se procesen
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verificar que las opciones se configuraron correctamente
          const verifyResponse = await client.get({
            path: `products/${product_id}`,
            query: {
              fields: 'options'
            }
          });
          
          const updatedOptions = verifyResponse.body.product.options || [];
          console.log('Opciones verificadas:', updatedOptions);
          
          if (updatedOptions.length === 0) {
            throw new Error('Las opciones no se configuraron correctamente');
          }
          
        } catch (optionError) {
          console.error('Error configurando opciones:', optionError);
          return res.status(500).json({ 
            success: false, 
            error: `Error configurando opciones del producto: ${optionError.message}` 
          });
        }
      }
    } else {
      // Si el producto ya tiene variantes, verificar que las opciones coincidan
      console.log('Producto con variantes existentes, verificando opciones...');
      console.log('Opciones existentes:', existingOptions);
      console.log('Opciones de la variante:', {
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3
      });
      
      // Verificar si el producto tiene la opción "Default Title" (que no se puede modificar)
      const hasDefaultTitle = existingOptions.some(option => 
        option.name === 'Title' && option.values.includes('Default Title')
      );
      
      if (hasDefaultTitle) {
        console.log('Producto tiene opción "Default Title" - no se pueden modificar las opciones');
        console.log('Usando las opciones existentes para crear la variante');
        
        // Para productos con "Default Title", usar las opciones existentes
        // y crear la variante con los valores disponibles
        const defaultTitleOption = existingOptions.find(option => option.name === 'Title');
        
        if (defaultTitleOption && defaultTitleOption.values.includes('Default Title')) {
          console.log('Usando "Default Title" como option1');
          variant.option1 = 'Default Title';
          
          // Si el producto solo tiene una opción, no usar option2 ni option3
          if (existingOptions.length === 1) {
            console.log('Producto solo tiene una opción, ignorando option2 y option3');
            variant.option2 = undefined;
            variant.option3 = undefined;
          }
        }
      } else {
        // Verificar que las opciones de la variante coincidan con las configuradas
        if (variant.option1 && existingOptions.length > 0 && !existingOptions[0].values.includes(variant.option1)) {
          console.log('Agregando valor a Option 1:', variant.option1);
          const updatedValues = [...existingOptions[0].values, variant.option1];
          
          await client.put({
            path: `products/${product_id}`,
            data: {
              product: {
                id: product_id,
                options: [
                  {
                    id: existingOptions[0].id,
                    name: existingOptions[0].name,
                    values: updatedValues
                  },
                  ...existingOptions.slice(1)
                ]
              }
            }
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (variant.option2 && existingOptions.length > 1 && !existingOptions[1].values.includes(variant.option2)) {
          console.log('Agregando valor a Option 2:', variant.option2);
          const updatedValues = [...existingOptions[1].values, variant.option2];
          
          await client.put({
            path: `products/${product_id}`,
            data: {
              product: {
                id: product_id,
                options: [
                  existingOptions[0],
                  {
                    id: existingOptions[1].id,
                    name: existingOptions[1].name,
                    values: updatedValues
                  },
                  ...existingOptions.slice(2)
                ]
              }
            }
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Crear la variante
    console.log('Creando variante:', variant);
    const variantResponse = await client.post({
      path: `products/${product_id}/variants`,
      data: {
        variant: {
          price: variant.price,
          sku: variant.sku,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          inventory_quantity: variant.inventory_quantity || 0
        }
      }
    });

    const createdVariant = variantResponse.body.variant;
    console.log('Variante creada exitosamente:', createdVariant.id);

    // Si hay imágenes, subirlas y asociarlas con la variante
    if (images && Array.isArray(images) && images.length > 0) {
      console.log('Subiendo imágenes para la variante...');
      
      const imagePromises = images.map(image => 
        client.post({
          path: `products/${product_id}/images`,
          data: {
            image: {
              src: image.url,
              alt: image.alt || '',
              position: image.position || 1,
              variant_ids: [createdVariant.id]
            }
          }
        })
      );

      const imageResponses = await Promise.all(imagePromises);
      createdVariant.images = imageResponses.map(response => response.body.image);
      
      console.log('Imágenes asociadas exitosamente');
    }

    res.json({ 
      success: true, 
      variant: createdVariant 
    });
  } catch (error) {
    console.error('Error en createVariant:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = {
  createProducts,
  updateProducts,
  updatePrices,
  disableProducts,
  createVariant
}; 