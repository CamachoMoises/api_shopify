const { client } = require('../config/shopify');

/**
 * Obtiene los datos detallados de un cliente específico
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getCustomerDetails = async (req, res) => {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID del cliente'
      });
    }

    console.log('Obteniendo detalles del cliente:', customer_id);

    // Obtener datos básicos del cliente
    const customer = await client.get({
      path: `customers/${customer_id}`,
      query: {
        fields: 'id,email,first_name,last_name,created_at,updated_at,orders_count,total_spent,accepts_marketing,phone,default_address,addresses,note,state,tags,tax_exempt,verified_email,mailing_address'
      }
    });

    // Obtener metadatos del cliente
    const metafields = await client.get({
      path: `customers/${customer_id}/metafields`,
      query: {
        fields: 'id,namespace,key,value,type'
      }
    });

    // Obtener órdenes recientes del cliente
    const orders = await client.get({
      path: 'orders',
      query: {
        customer_id: customer_id,
        limit: 5,
        status: 'any',
        fields: 'id,order_number,created_at,total_price,currency,status'
      }
    });
console.log(customer)
    // Combinar la información
    const customerData = {
      ...customer.body.customer,
      recent_orders: orders.body.orders,
      last_order_id: orders.body.orders[0]?.id,
      last_order_date: orders.body.orders[0]?.created_at,
      metafields: metafields.body.metafields
    };

    console.log('Detalles del cliente obtenidos exitosamente:', JSON.stringify(customerData, null, 2));

    return res.status(200).json({
      success: true,
      data: {
        customer: customerData
      }
    });

  } catch (error) {
    console.error('Error al obtener detalles del cliente:', error);
    
    // Manejar errores específicos de Shopify
    if (error.response) {
      const status = error.response.status;
      const body = error.response.body;

      if (status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Cliente no encontrado'
        });
      }

      if (status === 403) {
        return res.status(403).json({
          success: false,
          error: 'No tiene permisos para acceder a este recurso'
        });
      }

      return res.status(status).json({
        success: false,
        error: body.errors || 'Error al obtener detalles del cliente'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener detalles del cliente'
    });
  }
};

module.exports = {
  getCustomerDetails
}; 