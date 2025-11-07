const { graphqlClient } = require('../config/shopify');

// Update inventory quantities using GraphQL Admin API
const updateInventoryGraphQL = async (req, res) => {
	const axios = require('axios');
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(
		/^https?:\/\//,
		''
	);

	// Configuración de rate limiting
	const DELAY_BETWEEN_REQUESTS = 500; // 500ms = 2 requests/segundo
	const MAX_RETRIES = 3;
	const MAX_BATCH_SIZE = 100;

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

		// Validar límite máximo
		if (inventory_updates.length > MAX_BATCH_SIZE) {
			return res.status(400).json({
				success: false,
				error: `El número de actualizaciones (${inventory_updates.length}) excede el límite máximo (${MAX_BATCH_SIZE}). Por favor, divida la solicitud en lotes más pequeños.`,
				max_allowed: MAX_BATCH_SIZE,
				received: inventory_updates.length,
			});
		}

		console.log(`\n=== ACTUALIZANDO INVENTARIO ===`);
		console.log(
			`Total de actualizaciones: ${inventory_updates.length}`
		);

		const results = [];
		const errors = [];
		const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

		// Función para hacer request con reintentos
		const requestWithRetry = async (requestFn, retries = MAX_RETRIES) => {
			for (let attempt = 1; attempt <= retries; attempt++) {
				try {
					return await requestFn();
				} catch (error) {
					if (error.response?.status === 429) {
						const retryAfter =
							parseInt(error.response.headers['retry-after'] || '2') *
							1000;
						console.log(
							`  ⏳ Rate limit alcanzado. Esperando ${
								retryAfter / 1000
							}s... (Intento ${attempt}/${retries})`
						);
						await sleep(retryAfter);

						if (attempt === retries) {
							throw error;
						}
					} else {
						throw error;
					}
				}
			}
		};

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
					`[${i + 1}/${inventory_updates.length}] Actualizando: Product ${product_id}, Quantity ${quantity}`
				);

				const updateUrl = `https://${shopUrl}/admin/api/2024-10/inventory_levels/set.json`;

				const response = await requestWithRetry(async () => {
					return await axios.post(
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
				});

				results.push({
					index: i,
					product_id,
					shopify_inventory_item_id,
					shopify_location_id,
					quantity: parseInt(quantity),
					success: true,
					inventory_level: response.data.inventory_level,
				});

				console.log(`  ✓ Exitoso`);

				// Esperar entre requests (excepto en el último)
				if (i < inventory_updates.length - 1) {
					await sleep(DELAY_BETWEEN_REQUESTS);
				}
			} catch (updateError) {
				console.error(
					`  ✗ Error:`,
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
				process.env.NODE_ENV === 'development' ? err.stack : undefined,
		});
	}
};

module.exports = {
	updateInventoryGraphQL,
};
