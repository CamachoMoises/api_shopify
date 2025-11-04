const express = require('express');
const router = express.Router();
const {
  createProducts,
  updateProducts,
  updatePrices,
  disableProducts,
  createVariant
} = require('../controllers/productController');

// Product routes
router.post('/bulk', createProducts);
router.put('/bulk', updateProducts);
router.put('/prices/bulk', updatePrices);
router.put('/disable/bulk', disableProducts);
router.post('/variant', createVariant);

module.exports = router; 