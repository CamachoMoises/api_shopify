const { graphqlClient } = require('../config/shopify');

/**
 * Obtiene la dirección por defecto de un cliente específico usando GraphQL
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getCustomerDefaultAddress = async (req, res) => {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID del cliente'
      });
    }

    // Query GraphQL para obtener la dirección por defecto del cliente
    const query = `
      query getCustomerDefaultAddress($id: ID!) {
        customer(id: $id) {
          id
          defaultAddress {
            id
            address1
            address2
            city
            province
            provinceCode
            zip
            country
            countryCodeV2
            phone
            company
            firstName
            lastName
            formatted
            formattedArea
          }
        }
      }
    `;

    // Variables para la query
    const variables = {
      id: `gid://shopify/Customer/${customer_id}`
    };

    console.log('Obteniendo dirección por defecto del cliente:', customer_id);

    // Ejecutar la query usando el cliente GraphQL configurado
    const response = await graphqlClient.query({
      data: {
        query: query,
        variables: variables
      }
    });

    console.log('GraphQL response:', response.body);

    // Verificar si hay errores
    if (response.body.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(response.body.errors)}`);
    }

    if (!response.body.data?.customer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customer: response.body.data.customer
      }
    });

  } catch (error) {
    console.error('Error al obtener la dirección por defecto del cliente:', error);
    
    // Manejar errores específicos
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener la dirección por defecto del cliente'
    });
  }
};

module.exports = {
  getCustomerDefaultAddress
}; 