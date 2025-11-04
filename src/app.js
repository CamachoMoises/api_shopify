const express = require('express');
const productRoutes = require('./routes/productRoutes');
const productGraphQLRoutes = require('./routes/productGraphQLRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const inventoryGraphQLRoutes = require('./routes/inventoryGraphQLRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const customerGraphQLRoutes = require('./routes/customerGraphQLRoutes');
const vendorRoutes = require('./routes/vendorRoutes');

const app = express();
app.use(express.json());

// API routes
app.use('/api/products', productRoutes);
app.use('/api/products', productGraphQLRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory', inventoryGraphQLRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/customers/graphql', customerGraphQLRoutes);
app.use('/api/vendor', vendorRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something broke!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 