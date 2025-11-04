const express = require('express');
const router = express.Router();
const {
  handleVendorProducts,
  handleVendorProductUpdates,
  handleVendorPriceUpdates,
  handleVendorInventoryUpdates,
  handleVendorProductDisable
} = require('../controllers/vendorController');

const { queryProducts } = require('../controllers/vendorProductQueryController');
const { getCustomerDetails } = require('../controllers/vendorCustomerController');

const {
  validateVendorId,
  validateProductCreation,
  validateProductUpdate,
  validatePriceUpdate,
  validateInventoryUpdate,
  validateProductDisable
} = require('../middleware/validateVendor');

// Vendor routes with validation
router.post('/products', [validateVendorId, validateProductCreation], handleVendorProducts);
router.put('/products', [validateVendorId, validateProductUpdate], handleVendorProductUpdates);
router.put('/prices', validatePriceUpdate, handleVendorPriceUpdates);
router.put('/inventory', validateInventoryUpdate, handleVendorInventoryUpdates);
router.put('/products/disable', validateProductDisable, handleVendorProductDisable);

// Nueva ruta para consultar productos
router.get('/products/query', queryProducts);

// Rutas de clientes
router.get('/customers/:customer_id', getCustomerDetails);

module.exports = router; 