const { client } = require('../config/shopify');
const axios = require('axios');

// Get orders with status filter
const getOrders = async (req, res) => {
  try {
    const { id, order_number } = req.query;
    let response;

    if (id || order_number) {
      // Si se proporciona un ID o número de orden, buscar esa orden específica
      if (order_number) {
        // Primero buscar la orden por su número
        response = await client.get({
          path: 'orders',
          query: {
            name: order_number,
            limit: 1
          }
        });

        if (!response.body.orders || response.body.orders.length === 0) {
          return res.status(404).json({ 
            success: false, 
            error: `No se encontró la orden con número ${order_number}` 
          });
        }

        // Obtener los detalles completos de la orden usando su ID
        response = await client.get({
          path: `orders/${response.body.orders[0].id}`
        });
      } else {
        // Si se proporciona un ID, buscar directamente
        response = await client.get({
          path: `orders/${id}`
        });
      }

      // Consultar el endpoint externo con el ID de la orden
      try {
        const orderId = response.body.order.id.toString();
        console.log('ID de la orden obtenida:', orderId);

        const requestBody = {
          data: {
            documentPath: `/orders/${orderId}`,
            documentId: orderId
          }
        };
        console.log('Solicitud al endpoint externo:', JSON.stringify(requestBody, null, 2));

        const externalResponse = await axios.post('https://getorder-7mk23r5w3a-uc.a.run.app', requestBody);
        console.log('Respuesta completa del endpoint externo:', JSON.stringify(externalResponse.data, null, 2));

        // Extraer solo los datos relevantes
        const billingInfo = externalResponse.data.result.data;
        console.log('Datos de facturación extraídos:', JSON.stringify(billingInfo, null, 2));

        // Combinar la respuesta de Shopify con la del endpoint externo
        response.body.order.billing_information = billingInfo;
      } catch (externalError) {
        console.error('Error al consultar el endpoint externo:', externalError.response?.data || externalError.message);
        // Continuar con la respuesta de Shopify incluso si falla la consulta externa
      }

      return res.json({ success: true, order: response.body.order });
    }

    // Si no hay ID o número de orden, obtener todas las órdenes con filtros
    response = await client.get({
      path: 'orders',
      query: {
        status: req.query.status || 'any',
        limit: req.query.limit || 50,
        financial_status: req.query.financial_status
      },
    });

    console.log('Listado final de órdenes:', JSON.stringify(response.body.orders, null, 2));
    res.json({ success: true, orders: response.body.orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Mark order as paid
const markOrderAsPaid = async (req, res) => {
  try {
    const { order_id, payment_details } = req.body;

    const response = await client.post({
      path: `orders/${order_id}/transactions`,
      data: {
        transaction: {
          kind: 'capture',
          status: 'success',
          amount: payment_details.amount,
          currency: payment_details.currency,
          gateway: payment_details.gateway,
          source: 'external',
          message: payment_details.message || 'Payment processed externally'
        }
      }
    });

    res.json({ success: true, transaction: response.body.transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getOrders,
  markOrderAsPaid
}; 