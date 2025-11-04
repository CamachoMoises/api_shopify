const { client } = require('../config/shopify');

// Get list of customers with their data
const getCustomers = async (req, res) => {
  try {
    const response = await client.get({
      path: 'customers',
      query: {
        limit: req.query.limit || 50,
        fields: 'id,first_name,last_name,email,phone,orders_count,total_spent,created_at,updated_at,addresses'
      }
    });

    res.json({ success: true, customers: response.body.customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getCustomers
}; 