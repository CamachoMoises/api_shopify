const express = require('express');
const router = express.Router();
const { updateInventoryGraphQL, getShopifyLocations, resetAllInventoryToZero } = require('../controllers/inventoryGraphQLController');

// Ruta para actualizar inventario usando GraphQL
router.put('/graphql', updateInventoryGraphQL);
router.get('/graphql/ubicaciones', getShopifyLocations);
router.post('/graphql/reset', resetAllInventoryToZero);

module.exports = router; 