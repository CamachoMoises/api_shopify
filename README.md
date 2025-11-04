# API de Integración con Shopify

Esta API proporciona endpoints para interactuar con la plataforma Shopify, permitiendo la gestión de productos, inventario, precios y más.

## Tabla de Contenidos

- [Autenticación](#autenticación)
- [Glosario de Endpoints](#glosario-de-endpoints)
  - [Productos](#productos)
  - [Precios](#precios)
  - [Inventario](#inventario)
  - [Estado de Productos](#estado-de-productos)
  - [Órdenes](#órdenes)
  - [Clientes](#clientes)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Manejo de Errores](#manejo-de-errores)

## Autenticación

Todas las solicitudes a la API requieren autenticación mediante un token de acceso. Este token debe incluirse en el encabezado de la solicitud:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Glosario de Endpoints

### Productos

#### Crear Productos con GraphQL (POST `/api/products/graphql/create`)

**Body:**
```json
{
  "products": [
    {
      "title": "string (requerido)",
      "description": "string (opcional)",
      "category": "string (opcional)",
      "vendor": "string (requerido)",
      "options": [
        {
          "name": "string (requerido)",
          "values": ["string (requerido)"]
        }
      ],
      "variants": [
        {
          "price": "number (requerido)",
          "sku": "string (requerido)",
          "option1": "string (opcional)",
          "option2": "string (opcional)"
        }
      ],
      "images": [
        {
          "url": "string (opcional)",
          "alt": "string (opcional)",
          "variant_ids": ["string (opcional)"]
        }
      ],
      "tags": ["string (opcional)"]
    }
  ]
}
```

**Ejemplo con múltiples variantes e imágenes por variante:**
```json
{
  "products": [
    {
      "title": "Camiseta Básica",
      "description": "Camiseta de algodón 100% con diseño minimalista",
      "category": "Ropa",
      "vendor": "VENDOR123",
      "options": [
        {
          "name": "Color",
          "values": ["Negro", "Blanco"]
        },
        {
          "name": "Talla",
          "values": ["S", "M", "L"]
        }
      ],
      "variants": [
        {
          "price": "19.99",
          "sku": "TSH-BLK-S",
          "option1": "Negro",
          "option2": "S"
        },
        {
          "price": "19.99",
          "sku": "TSH-BLK-M",
          "option1": "Negro",
          "option2": "M"
        },
        {
          "price": "21.99",
          "sku": "TSH-WHT-S",
          "option1": "Blanco",
          "option2": "S"
        },
        {
          "price": "21.99",
          "sku": "TSH-WHT-M",
          "option1": "Blanco",
          "option2": "M"
        }
      ],
      "images": [
        {
          "url": "https://ejemplo.com/camiseta-negra.jpg",
          "alt": "Camiseta Negra",
          "variant_ids": ["TSH-BLK-S", "TSH-BLK-M"]
        },
        {
          "url": "https://ejemplo.com/camiseta-blanca.jpg",
          "alt": "Camiseta Blanca",
          "variant_ids": ["TSH-WHT-S", "TSH-WHT-M"]
        }
      ],
      "tags": ["camisetas", "básicas", "algodón"]
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "products": [
    {
      "id": "gid://shopify/Product/123456789",
      "title": "Camiseta Básica",
      "handle": "camiseta-basica",
      "descriptionHtml": "Camiseta de algodón 100% con diseño minimalista",
      "vendor": "VENDOR123",
      "productType": "Ropa",
      "status": "ACTIVE",
      "variants": {
        "edges": [
          {
            "node": {
              "id": "gid://shopify/ProductVariant/987654321",
              "sku": "TSH-BLK-S",
              "price": "19.99",
              "inventoryQuantity": 0,
              "selectedOptions": [
                {
                  "name": "Color",
                  "value": "Negro"
                },
                {
                  "name": "Talla",
                  "value": "S"
                }
              ]
            }
          }
        ]
      },
      "images": {
        "edges": [
          {
            "node": {
              "id": "gid://shopify/ProductImage/111111111",
              "url": "https://ejemplo.com/camiseta-negra.jpg",
              "altText": "Camiseta Negra"
            }
          }
        ]
      }
    }
  ]
}
```

#### Actualizar Precios de Variantes con GraphQL (PUT `/api/products/prices/graphql`)

**Body:**
```json
{
  "price_updates": [
    {
      "shopify_variant_id": "string (requerido)",
      "compare_at_price": "number (requerido)"
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "results": [
    {
      "id": "gid://shopify/ProductVariant/123456789",
      "price": "19.99",
      "compareAtPrice": "29.99",
      "sku": "PRODUCT-SKU-123"
    }
  ]
}
```

#### Crear Producto con Variantes e Imágenes en una Sola Mutación (POST `/api/products/graphql/create-with-media`)

Este endpoint permite crear un producto con todas sus variantes e imágenes en una sola operación, asociando automáticamente las imágenes con las variantes correspondientes.

**Body:**
```json
{
  "product": {
    "title": "string (requerido)",
    "description": "string (requerido)",
    "vendor": "string (requerido)",
    "category": "string (requerido)",
    "options": ["string"],
    "images": [
      {
        "url": "string (requerido)",
        "alt": "string"
      }
    ],
    "variants": [
      {
        "price": "string (requerido)",
        "sku": "string (requerido)",
        "options": ["string"],
        "imageUrls": ["string"]
      }
    ],
    "tags": ["string"]
  }
}
```

**Notas importantes:**
- El producto se creará y publicará automáticamente en la tienda online
- El campo `variantIndex` en las imágenes es opcional. Si se proporciona, la imagen se asociará con la variante específica.
- Si no se proporciona `variantIndex`, la imagen se asociará con el producto general.
- Los índices de variantes comienzan en 0 y deben corresponder con el orden de las variantes en el array `variants`.
- Las imágenes deben estar disponibles en una URL accesible públicamente.
- Los formatos de imagen soportados son: JPEG, PNG y WEBP.

**Respuesta:**
```json
{
  "success": true,
  "product": {
    "id": "gid://shopify/Product/123456789",
    "title": "Jarrón Decorativo",
    "handle": "jarron-decorativo",
    "variants": {
      "edges": [
        {
          "node": {
            "id": "gid://shopify/ProductVariant/987654321",
            "sku": "JAR-BEI",
            "price": "49.99",
            "selectedOptions": [
              {
                "name": "Color",
                "value": "Beige"
              }
            ],
            "media": {
              "edges": [
                {
                  "node": {
                    "id": "gid://shopify/MediaImage/111111111",
                    "alt": "Jarrón Beige",
                    "image": {
                      "url": "https://cdn.shopify.com/..."
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    }
  }
}
```

#### Eliminar Producto con GraphQL (DELETE `/api/products/graphql/delete`)

Este endpoint permite eliminar un producto específico usando la API GraphQL de Shopify.

**Body:**
```json
{
  "product_id": "gid://shopify/Product/123456789"
}
```

**Respuesta:**
```json
{
  "success": true,
  "deletedProductId": "gid://shopify/Product/123456789"
}
```

**Notas importantes:**
- El `product_id` debe ser un ID válido de Shopify en formato GraphQL (gid://shopify/Product/...)
- La eliminación es permanente y no se puede deshacer
- Se recomienda verificar el ID del producto antes de eliminarlo

#### Crear Variante (POST `/api/products/variant`)

Este endpoint permite crear una nueva variante para un producto existente y asociarle imágenes.

**Body:**
```json
{
  "product_id": "string (requerido)",
  "variant": {
    "price": "string (requerido)",
    "sku": "string (requerido)",
    "option1": "string (opcional)",
    "option2": "string (opcional)",
    "option3": "string (opcional)",
    "inventory_quantity": "number (opcional, default: 0)"
  },
  "images": [
    {
      "url": "string (requerido)",
      "alt": "string (opcional)",
      "position": "number (opcional, default: 1)"
    }
  ]
}
```

**Ejemplo:**
```json
{
  "product_id": "123456789",
  "variant": {
    "price": "29.99",
    "sku": "TSH-BLK-L",
    "option1": "Negro",
    "option2": "L",
    "inventory_quantity": 10
  },
  "images": [
    {
      "url": "https://ejemplo.com/camiseta-negra-l.jpg",
      "alt": "Camiseta Negra Talla L",
      "position": 1
    },
    {
      "url": "https://ejemplo.com/camiseta-negra-l-detalle.jpg",
      "alt": "Detalle de la Camiseta Negra Talla L",
      "position": 2
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "variant": {
    "id": "gid://shopify/ProductVariant/987654321",
    "price": "29.99",
    "sku": "TSH-BLK-L",
    "option1": "Negro",
    "option2": "L",
    "inventory_quantity": 10,
    "inventory_management": "shopify",
    "inventory_policy": "deny",
    "images": [
      {
        "id": "gid://shopify/ProductImage/111111111",
        "src": "https://ejemplo.com/camiseta-negra-l.jpg",
        "alt": "Camiseta Negra Talla L",
        "position": 1
      },
      {
        "id": "gid://shopify/ProductImage/222222222",
        "src": "https://ejemplo.com/camiseta-negra-l-detalle.jpg",
        "alt": "Detalle de la Camiseta Negra Talla L",
        "position": 2
      }
    ]
  }
}
```

**Notas importantes:**
- El `product_id` debe ser un ID válido de un producto existente en Shopify
- La variante se creará con gestión de inventario habilitada por defecto
- La política de inventario se establece como "deny" por defecto (no permitir ventas cuando no hay stock)
- Los campos `option1`, `option2` y `option3` deben coincidir con las opciones definidas en el producto
- Las imágenes son opcionales y pueden ser múltiples
- **Si el producto no tiene variantes existentes, el endpoint configurará automáticamente las opciones necesarias**

#### Crear Variante con GraphQL (POST `/api/products/variant/graphql`)

Este endpoint permite crear una nueva variante para un producto existente usando la API GraphQL de Shopify. Es más robusto para manejar productos sin variantes existentes.

**Body:**
```json
{
  "product_id": "string (requerido)",
  "variant": {
    "price": "string (requerido)",
    "sku": "string (requerido)",
    "option1": "string (opcional)",
    "option2": "string (opcional)",
    "option3": "string (opcional)",
    "inventory_quantity": "number (opcional, default: 0)"
  },
  "images": [
    {
      "url": "string (requerido)",
      "alt": "string (opcional)"
    }
  ]
}
```

**Ejemplo:**
```json
{
  "product_id": "gid://shopify/Product/123456789",
  "variant": {
    "price": "29.99",
    "sku": "TSH-BLK-L",
    "option1": "Negro",
    "option2": "L",
    "inventory_quantity": 10
  },
  "images": [
    {
      "url": "https://ejemplo.com/camiseta-negra-l.jpg",
      "alt": "Camiseta Negra Talla L"
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "variant": {
    "id": "gid://shopify/ProductVariant/987654321",
    "sku": "TSH-BLK-L",
    "price": "29.99",
    "inventoryQuantity": 10,
    "selectedOptions": [
      {
        "name": "Option 1",
        "value": "Negro"
      },
      {
        "name": "Option 2",
        "value": "L"
      }
    ]
  }
}
```

**Notas importantes:**
- El `product_id` puede ser un ID numérico o un ID GraphQL completo (gid://shopify/Product/...)
- **Este endpoint maneja automáticamente productos sin variantes existentes configurando las opciones necesarias**
- Es más robusto que el endpoint REST para casos complejos
- Las imágenes se procesan usando la API de medios de Shopify
- Proporciona mejor manejo de errores y logging detallado

### Inventario

#### Actualizar Inventario con GraphQL (PUT `/api/inventory/graphql`)

**Body:**
```json
{
  "inventory_updates": [
    {
      "shopify_location_id": "string (requerido)",
      "shopify_inventory_item_id": "string (requerido)",
      "quantity": "number (requerido)"
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "results": [
    {
      "id": "gid://shopify/InventoryLevel/123456789",
      "available": 100,
      "location": {
        "id": "gid://shopify/Location/81549426943"
      },
      "item": {
        "id": "gid://shopify/InventoryItem/48844024119551"
      }
    }
  ]
}
```

### Estado de Productos

#### Deshabilitar Productos (PUT `/api/vendor/products/disable`)

**Body:**
```json
{
  "disable_requests": [
    {
      "shopify_product_id": "string (requerido)"
    }
  ]
}
```

### Órdenes

#### Obtener Órdenes (GET `/api/orders`)

**QueryParams:**
- `id`: string (opcional) - ID de la orden a buscar
- `order_number`: string (opcional) - Número de orden a buscar
- `status`: string (opcional) - Estado de las órdenes a filtrar (ej: "open", "closed", "cancelled")
- `limit`: number (opcional) - Número máximo de órdenes a retornar (por defecto: 50)
- `financial_status`: string (opcional) - Estado financiero de las órdenes (ej: "pending", "paid", "refunded")

**Respuesta para búsqueda por ID o número de orden:**
```json
{
  "success": true,
  "order": {
    "id": "string",
    "order_number": "string",
    "created_at": "string",
    "total_price": "string",
    "currency": "string",
    "external_data": {
      // Datos adicionales del endpoint externo
    },
    "customer": {
      "id": "string",
      "email": "string",
      "first_name": "string",
      "last_name": "string"
    },
    "line_items": [
      {
        "id": "string",
        "product_id": "string",
        "variant_id": "string",
        "quantity": "number",
        "price": "string"
      }
    ],
    "shipping_address": {
      "address1": "string",
      "address2": "string",
      "city": "string",
      "province": "string",
      "country": "string",
      "zip": "string"
    }
  }
}
```

**Respuesta para listado de órdenes:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "string",
      "order_number": "string",
      "created_at": "string",
      "total_price": "string",
      "currency": "string",
      "customer": {
        "id": "string",
        "email": "string",
        "first_name": "string",
        "last_name": "string"
      },
      "line_items": [
        {
          "id": "string",
          "product_id": "string",
          "variant_id": "string",
          "quantity": "number",
          "price": "string"
        }
      ],
      "shipping_address": {
        "address1": "string",
        "address2": "string",
        "city": "string",
        "province": "string",
        "country": "string",
        "zip": "string"
      }
    }
  ]
}
```

### Clientes

#### Obtener Clientes (GET `/api/vendor/customers`)

**QueryParams:**
- `limit`: number (opcional) - Número máximo de clientes a retornar (por defecto: 50)
- `since_id`: string (opcional) - ID del último cliente recibido para paginación
- `created_at_min`: string (opcional) - Fecha mínima de creación (formato: YYYY-MM-DD)
- `created_at_max`: string (opcional) - Fecha máxima de creación (formato: YYYY-MM-DD)
- `email`: string (opcional) - Filtrar por dirección de correo electrónico
- `first_name`: string (opcional) - Filtrar por nombre
- `last_name`: string (opcional) - Filtrar por apellido

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "string",
        "email": "string",
        "first_name": "string",
        "last_name": "string",
        "created_at": "string",
        "updated_at": "string",
        "orders_count": "number",
        "total_spent": "string",
        "default_address": {
          "address1": "string",
          "address2": "string",
          "city": "string",
          "province": "string",
          "country": "string",
          "zip": "string"
        }
      }
    ],
    "pagination": {
      "next_page": "string",
      "previous_page": "string"
    }
  }
}
```

#### Obtener Datos de Cliente Específico (GET `/api/vendor/customers/:customer_id`)

**PathParams:**
- `customer_id`: string (requerido) - ID del cliente a consultar

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "string",
      "email": "string",
      "first_name": "string",
      "last_name": "string",
      "created_at": "string",
      "updated_at": "string",
      "orders_count": "number",
      "total_spent": "string",
      "last_order_id": "string",
      "last_order_date": "string",
      "accepts_marketing": "boolean",
      "phone": "string",
      "note": "string",
      "state": "string",
      "tags": ["string"],
      "tax_exempt": "boolean",
      "verified_email": "boolean",
      "default_address": {
        "id": "string",
        "address1": "string",
        "address2": "string",
        "city": "string",
        "province": "string",
        "country": "string",
        "zip": "string",
        "phone": "string"
      },
      "mailing_address": {
        "address1": "string",
        "address2": "string",
        "city": "string",
        "province": "string",
        "country": "string",
        "zip": "string",
        "phone": "string"
      },
      "addresses": [
        {
          "id": "string",
          "address1": "string",
          "address2": "string",
          "city": "string",
          "province": "string",
          "country": "string",
          "zip": "string",
          "phone": "string",
          "default": "boolean"
        }
      ],
      "recent_orders": [
        {
          "id": "string",
          "order_number": "string",
          "created_at": "string",
          "total_price": "string",
          "currency": "string",
          "status": "string"
        }
      ],
      "metafields": [
        {
          "id": "string",
          "namespace": "string",
          "key": "string",
          "value": "string",
          "type": "string"
        }
      ]
    }
  }
}
```

#### Obtener Dirección por Defecto del Cliente (GET `/api/customers/graphql/default-address/:customer_id`)

**PathParams:**
- `customer_id`: string (requerido) - ID del cliente a consultar

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "string",
      "defaultAddress": {
        "id": "string",
        "address1": "string",
        "address2": "string",
        "city": "string",
        "province": "string",
        "provinceCode": "string",
        "zip": "string",
        "country": "string",
        "countryCodeV2": "string",
        "phone": "string",
        "company": "string",
        "firstName": "string",
        "lastName": "string",
        "formatted": "string",
        "formattedArea": "string"
      }
    }
  }
}
```

**Errores:**
- `400 Bad Request`: Si no se proporciona el ID del cliente
- `404 Not Found`: Si el cliente no existe
- `500 Internal Server Error`: Si ocurre un error interno del servidor

### Gestión de Variantes

#### Actualizar Imágenes de Variante
```http
POST /api/products/variant/update-media
```
Actualiza o elimina las imágenes de una variante de producto.

**Cuerpo de la solicitud:**
```json
{
    "variant_id": "gid://shopify/ProductVariant/1234567890",
    "images": [
        {
            "url": "https://example.com/image.jpg",
            "alt": "Image description"
        }
    ]
}
```
- Para eliminar todas las imágenes, envía un array vacío en `images`.
- Para agregar nuevas imágenes, incluye los objetos de imagen con `url` y `alt` (opcional).

**Respuesta exitosa:**
```json
{
    "success": true,
    "message": "Variant images updated successfully"
}
```

#### Eliminar Variante
```http
POST /api/products/variant/delete
```
Elimina una variante de producto específica.

**Cuerpo de la solicitud:**
```json
{
    "variant_id": "gid://shopify/ProductVariant/1234567890"
}
```

**Respuesta exitosa:**
```json
{
    "success": true,
    "deletedVariantId": "gid://shopify/ProductVariant/1234567890"
}
```

## Ejemplos de Uso

### Crear Productos con GraphQL

```bash
curl -X POST http://localhost:3000/api/products/graphql/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "products": [
      {
        "title": "Camiseta Básica",
        "description": "Camiseta de algodón 100% con diseño minimalista",
        "category": "Ropa",
        "vendor": "VENDOR123",
        "variants": [
          {
            "price": "19.99",
            "sku": "TSH-BLK-S",
            "option1": "Negro",
            "option2": "S"
          }
        ],
        "images": [
          {
            "url": "https://ejemplo.com/camiseta.jpg",
            "alt": "Camiseta Negra",
            "variant_ids": ["TSH-BLK-S"]
          }
        ],
        "tags": ["camisetas", "básicas", "algodón"]
      }
    ]
  }'
```

## Manejo de Errores

Todas las respuestas de la API siguen un formato consistente:

### Respuesta Exitosa

```json
{
  "success": true,
  "data": { ... }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": "Mensaje de error descriptivo"
}
```

Los códigos de estado HTTP utilizados son:

- `200 OK`: Solicitud exitosa
- `400 Bad Request`: Parámetros inválidos o faltantes
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder al recurso
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error interno del servidor 

# Vendor API

## Endpoints

### POST /api/products/create

Crea productos en Shopify con soporte para variantes e imágenes asociadas.

#### Request Body

```json
{
  "products": [
    {
      "title": "Nombre del Producto",
      "description": "Descripción del producto",
      "vendor": "Código del Vendedor",
      "category": "Categoría del Producto",
      "variants": [
        {
          "price": "19.99",
          "sku": "SKU123",
          "option1": "Valor1",
          "option2": "Valor2"
        }
      ],
      "options": [
        {
          "name": "Nombre de la Opción",
          "values": ["Valor1", "Valor2"]
        }
      ],
      "images": [
        {
          "url": "https://ejemplo.com/imagen.webp",
          "alt": "Texto alternativo",
          "variantIndex": 0  // Opcional: índice de la variante a la que se asociará la imagen
        }
      ],
      "tags": ["etiqueta1", "etiqueta2"]
    }
  ]
}
```

#### Notas importantes:

- El campo `variantIndex` en las imágenes es opcional. Si se proporciona, la imagen se asociará con la variante específica.
- Si no se proporciona `variantIndex`, la imagen se asociará con el producto general.
- Los índices de variantes comienzan en 0 y deben corresponder con el orden de las variantes en el array `variants`.
- Las imágenes deben estar disponibles en una URL accesible públicamente.
- Los formatos de imagen soportados son: JPEG, PNG y WEBP.

#### Response

```json
{
  "success": true,
  "products": [
    {
      "id": "gid://shopify/Product/123456789",
      "title": "Nombre del Producto",
      "handle": "nombre-del-producto",
      "variants": {
        "edges": [
          {
            "node": {
              "id": "gid://shopify/ProductVariant/987654321",
              "sku": "SKU123",
              "price": "19.99"
            }
          }
        ]
      }
    }
  ]
}
```

