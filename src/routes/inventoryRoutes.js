const express = require('express');
const router = express.Router();
const { updateInventory } = require('../controllers/inventoryController');

// Inventory routes
router.put('/bulk', updateInventory);

module.exports = router; 