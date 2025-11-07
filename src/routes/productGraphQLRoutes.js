const express = require('express');
const router = express.Router();
const { 
  createProductsGraphQL, 
  updateVariantPricesGraphQL,
  createProductWithMediaGraphQL,
  deleteProductGraphQL,
  updateVariantMedia,
  deleteVariant,
  updateVariant,
  createVariantGraphQL,
  createProductFullFlow,
  deleteDefaultTitleVariants
} = require('../controllers/productGraphQLController');

// Ruta para crear productos usando GraphQL
router.post('/graphql/create', createProductsGraphQL);
// Ruta para actualizar precios de variantes usando GraphQL
router.put('/prices/graphql', updateVariantPricesGraphQL);

// Ruta para crear productos con medios en una sola mutación
router.post('/graphql/create-with-media', createProductWithMediaGraphQL);

// Ruta para eliminar productos usando GraphQL
router.delete('/graphql/delete', deleteProductGraphQL);

// Ruta para actualizar medios de variantes
router.post('/graphql/variant/update', updateVariant);
router.post('/variant/update-media', updateVariantMedia);

// Ruta para eliminar variantes
router.post('/variant/delete', deleteVariant);

// Ruta para crear variantes usando GraphQL
router.post('/variant/graphql', createVariantGraphQL);

// NUEVO: Ruta para crear producto + medios + variantes + links
router.post('/graphql/create-full', createProductFullFlow);

router.post('/graphql/deleteDefaultVariants', deleteDefaultTitleVariants);

module.exports = router; 