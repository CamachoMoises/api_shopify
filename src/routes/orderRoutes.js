const express = require('express');
const router = express.Router();
const { getOrders, markOrderAsPaid } = require('../controllers/orderController');

// Order routes
router.get('/', getOrders);
router.post('/:order_id/mark-paid', markOrderAsPaid);

module.exports = router; 