const express = require('express');
const router = express.Router();
const { updateInventoryGraphQL } = require('../controllers/inventoryGraphQLController');

// Ruta para actualizar inventario usando GraphQL
router.put('/graphql', updateInventoryGraphQL);

module.exports = router; 