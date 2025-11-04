const express = require('express');
const router = express.Router();
const { getCustomerDefaultAddress } = require('../controllers/customerGraphQLController');

// Rutas GraphQL para clientes
router.get('/default-address/:customer_id', getCustomerDefaultAddress);

module.exports = router; 