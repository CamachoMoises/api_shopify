const express = require('express');
const router = express.Router();
const { getCustomers } = require('../controllers/customerController');

// Customer routes
router.get('/', getCustomers);

module.exports = router; 