const { graphqlClient } = require('../config/shopify');

// Update inventory quantities using GraphQL Admin API
const updateInventoryGraphQL = async (req, res) => {
	const axios = require('axios');
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(
		/^https?:\/\//,
		''
	);

	try {
		const { inventory_updates } = req.body;

		if (
			!Array.isArray(inventory_updates) ||
			inventory_updates.length === 0
		) {
			return res.status(400).json({
				success: false,
				error:
					'Se requiere un array de inventory_updates con al menos un elemento',
			});
		}

		console.log(`\n=== ACTUALIZANDO INVENTARIO ===`);
		console.log(
			`Total de actualizaciones: ${inventory_updates.length}`
		);

		const results = [];
		const errors = [];

		for (let i = 0; i < inventory_updates.length; i++) {
			const update = inventory_updates[i];
			const {
				shopify_location_id,
				shopify_inventory_item_id,
				quantity,
				product_id,
			} = update;

			// Validar campos requeridos
			if (
				!shopify_location_id ||
				!shopify_inventory_item_id ||
				quantity === undefined
			) {
				errors.push({
					index: i,
					product_id,
					error:
						'Faltan campos requeridos: shopify_location_id, shopify_inventory_item_id, quantity',
				});
				continue;
			}

			try {
				console.log(
					`\n[${i + 1}/${
						inventory_updates.length
					}] Actualizando inventario:`
				);
				console.log(`  - Product ID: ${product_id}`);
				console.log(
					`  - Inventory Item ID: ${shopify_inventory_item_id}`
				);
				console.log(`  - Location ID: ${shopify_location_id}`);
				console.log(`  - Nueva cantidad: ${quantity}`);

				const updateUrl = `https://${shopUrl}/admin/api/2024-10/inventory_levels/set.json`;

				const response = await axios.post(
					updateUrl,
					{
						location_id: parseInt(shopify_location_id),
						inventory_item_id: parseInt(shopify_inventory_item_id),
						available: parseInt(quantity),
					},
					{
						headers: {
							'X-Shopify-Access-Token':
								process.env.SHOPIFY_ACCESS_TOKEN,
							'Content-Type': 'application/json',
						},
					}
				);

				results.push({
					index: i,
					product_id,
					shopify_inventory_item_id,
					shopify_location_id,
					quantity: parseInt(quantity),
					success: true,
					inventory_level: response.data.inventory_level,
				});

				console.log(`  ✓ Inventario actualizado exitosamente`);
			} catch (updateError) {
				console.error(
					`  ✗ Error actualizando inventario:`,
					updateError.response?.data || updateError.message
				);

				errors.push({
					index: i,
					product_id,
					shopify_inventory_item_id,
					shopify_location_id,
					error:
						updateError.response?.data?.errors || updateError.message,
					details: updateError.response?.data,
				});
			}
		}

		console.log(`\n=== RESUMEN ===`);
		console.log(`✓ Exitosos: ${results.length}`);
		console.log(`✗ Errores: ${errors.length}`);

		// Si hay errores pero también éxitos, devolver código 207 (Multi-Status)
		const statusCode =
			errors.length > 0 ? (results.length > 0 ? 207 : 400) : 200;

		return res.status(statusCode).json({
			success: errors.length === 0,
			total: inventory_updates.length,
			successful: results.length,
			failed: errors.length,
			results,
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (err) {
		console.error('\n=== ERROR GENERAL ===');
		console.error(err);
		return res.status(500).json({
			success: false,
			error: err.message,
			stack:
				process.env.NODE_ENV === 'development'
					? err.stack
					: undefined,
		});
	}
};

module.exports = {
	updateInventoryGraphQL,
};
