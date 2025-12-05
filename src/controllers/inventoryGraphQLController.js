const { graphqlClient } = require('../config/shopify');
const axios = require('axios');
// Update inventory quantities using GraphQL Admin API
const updateInventoryGraphQL = async (req, res) => {
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
		const sleep = (ms) =>
			new Promise((resolve) => setTimeout(resolve, ms));

		// Función para hacer request con reintentos
		const requestWithRetry = async (
			requestFn,
			retries = MAX_RETRIES
		) => {
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
					`[${i + 1}/${
						inventory_updates.length
					}] Actualizando: Product ${product_id}, Quantity ${quantity}`
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
				process.env.NODE_ENV === 'development'
					? err.stack
					: undefined,
		});
	}
};
const getShopifyLocations = async (req, res) => {
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(
		/^https?:\/\//,
		''
	);

	// Configuración de rate limiting
	const MAX_RETRIES = 3;

	try {
		console.log(`\n=== CONSULTANDO UBICACIONES ===`);

		const sleep = (ms) =>
			new Promise((resolve) => setTimeout(resolve, ms));

		// Función para hacer request con reintentos
		const requestWithRetry = async (
			requestFn,
			retries = MAX_RETRIES
		) => {
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

		// Obtener ubicaciones
		const locationsUrl = `https://${shopUrl}/admin/api/2024-10/locations.json`;

		const response = await requestWithRetry(async () => {
			return await axios.get(locationsUrl, {
				headers: {
					'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
					'Content-Type': 'application/json',
				},
			});
		});

		const locations = response.data.locations;

		console.log(
			`  ✓ ${locations.length} ubicación(es) encontrada(s)`
		);

		// Formatear la respuesta con información útil
		const formattedLocations = locations.map((location) => ({
			id: location.id,
			name: location.name,
			address1: location.address1,
			address2: location.address2,
			city: location.city,
			province: location.province,
			province_code: location.province_code,
			country: location.country,
			country_code: location.country_code,
			zip: location.zip,
			phone: location.phone,
			active: location.active,
			legacy: location.legacy,
			localized_country_name: location.localized_country_name,
			localized_province_name: location.localized_province_name,
		}));

		// Resumen por consola
		console.log('\n📍 Ubicaciones encontradas:');
		formattedLocations.forEach((loc) => {
			console.log(
				`  - ${loc.name} (ID: ${loc.id}) - ${
					loc.active ? '✓ Activa' : '✗ Inactiva'
				}`
			);
			if (loc.city || loc.country) {
				console.log(
					`    📍 ${[loc.city, loc.province, loc.country]
						.filter(Boolean)
						.join(', ')}`
				);
			}
		});

		return res.status(200).json({
			success: true,
			total: locations.length,
			locations: formattedLocations,
			active_locations: formattedLocations.filter((loc) => loc.active)
				.length,
			inactive_locations: formattedLocations.filter(
				(loc) => !loc.active
			).length,
		});
	} catch (err) {
		console.error('\n=== ERROR AL CONSULTAR UBICACIONES ===');
		console.error(err.response?.data || err.message);

		return res.status(err.response?.status || 500).json({
			success: false,
			error: err.response?.data?.errors || err.message,
			details: err.response?.data,
			stack:
				process.env.NODE_ENV === 'development'
					? err.stack
					: undefined,
		});
	}
};

const resetAllInventoryToZero = async (req, res) => {
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(/^https?:\/\//, '');

	// Configuración de rate limiting
	const DELAY_BETWEEN_REQUESTS = 500;
	const MAX_RETRIES = 3;
	const ITEMS_PER_PAGE = 250;

	try {
		// Obtener location_id del body o query params
		const { location_id } = req.body.location_id ? req.body : req.query;

		if (!location_id) {
			return res.status(400).json({
				success: false,
				error: 'Se requiere el parámetro location_id',
				example: {
					body: { location_id: "123456789" },
					or_query: "?location_id=123456789"
				}
			});
		}

		console.log(`\n=== RESETEO DE INVENTARIO A CERO ===`);
		console.log(`📍 Ubicación especificada: ${location_id}`);
		
		const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
		
		const requestWithRetry = async (requestFn, retries = MAX_RETRIES) => {
			for (let attempt = 1; attempt <= retries; attempt++) {
				try {
					return await requestFn();
				} catch (error) {
					if (error.response?.status === 429) {
						const retryAfter =
							parseInt(error.response.headers['retry-after'] || '2') * 1000;
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

		// Verificar que la ubicación existe
		console.log('📍 Verificando ubicación...');
		const locationsUrl = `https://${shopUrl}/admin/api/2024-10/locations.json`;
		const locationsResponse = await requestWithRetry(async () => {
			return await axios.get(locationsUrl, {
				headers: {
					'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
					'Content-Type': 'application/json',
				},
			});
		});

		const locations = locationsResponse.data.locations;
		const targetLocation = locations.find(loc => loc.id.toString() === location_id.toString());

		if (!targetLocation) {
			return res.status(404).json({
				success: false,
				error: `No se encontró la ubicación con ID: ${location_id}`,
				available_locations: locations.map(loc => ({
					id: loc.id,
					name: loc.name,
					active: loc.active
				}))
			});
		}

		console.log(`  ✓ Ubicación encontrada: ${targetLocation.name} (${targetLocation.active ? 'Activa' : 'Inactiva'})`);

		console.log('\n📦 Obteniendo productos e inventory items...');
		
		// Primero obtenemos todos los productos
		let allProducts = [];
		let hasNextPage = true;
		let pageInfo = null;

		while (hasNextPage) {
			let productsUrl = `https://${shopUrl}/admin/api/2024-10/products.json?limit=${ITEMS_PER_PAGE}&fields=id,variants`;
			
			if (pageInfo) {
				productsUrl += `&page_info=${pageInfo}`;
			}

			const productsResponse = await requestWithRetry(async () => {
				return await axios.get(productsUrl, {
					headers: {
						'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
						'Content-Type': 'application/json',
					},
				});
			});

			const products = productsResponse.data.products || [];
			allProducts = allProducts.concat(products);

			const linkHeader = productsResponse.headers['link'];
			if (linkHeader && linkHeader.includes('rel="next"')) {
				const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^>&]+)>;\s*rel="next"/);
				if (nextMatch) {
					pageInfo = nextMatch[1];
					console.log(`  📄 Página obtenida: ${allProducts.length} productos acumulados...`);
					await sleep(DELAY_BETWEEN_REQUESTS);
				} else {
					hasNextPage = false;
				}
			} else {
				hasNextPage = false;
			}
		}

		console.log(`  ✓ Total de productos: ${allProducts.length}`);

		// Extraer todos los inventory_item_ids de las variantes
		let allInventoryItemIds = [];
		allProducts.forEach(product => {
			product.variants.forEach(variant => {
				if (variant.inventory_item_id) {
					allInventoryItemIds.push({
						inventory_item_id: variant.inventory_item_id,
						variant_id: variant.id,
						product_id: product.id
					});
				}
			});
		});

		console.log(`  ✓ Total de inventory items encontrados: ${allInventoryItemIds.length}`);

		if (allInventoryItemIds.length === 0) {
			return res.status(200).json({
				success: true,
				message: 'No hay inventory items para actualizar',
				location: {
					id: targetLocation.id,
					name: targetLocation.name
				},
				total: 0,
				successful: 0,
				failed: 0,
			});
		}

		console.log('\n🔄 Reseteando inventario a 0...');
		const results = [];
		const errors = [];

		console.log(`\n📍 Procesando ubicación: ${targetLocation.name} (ID: ${targetLocation.id})`);

		for (let i = 0; i < allInventoryItemIds.length; i++) {
			const item = allInventoryItemIds[i];

			try {
				console.log(
					`  [${i + 1}/${allInventoryItemIds.length}] Item ID: ${item.inventory_item_id} (Product: ${item.product_id})`
				);

				const updateUrl = `https://${shopUrl}/admin/api/2024-10/inventory_levels/set.json`;

				const response = await requestWithRetry(async () => {
					return await axios.post(
						updateUrl,
						{
							location_id: parseInt(targetLocation.id),
							inventory_item_id: parseInt(item.inventory_item_id),
							available: 0,
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
					inventory_item_id: item.inventory_item_id,
					product_id: item.product_id,
					variant_id: item.variant_id,
					location_id: targetLocation.id,
					location_name: targetLocation.name,
					success: true,
				});

				console.log(`    ✓ Exitoso`);

				if (i < allInventoryItemIds.length - 1) {
					await sleep(DELAY_BETWEEN_REQUESTS);
				}
			} catch (updateError) {
				const errorMessage = updateError.response?.data?.errors || updateError.message;
				
				console.error(`    ✗ Error:`, errorMessage);

				errors.push({
					inventory_item_id: item.inventory_item_id,
					product_id: item.product_id,
					variant_id: item.variant_id,
					location_id: targetLocation.id,
					location_name: targetLocation.name,
					error: errorMessage,
				});
			}
		}

		console.log(`\n=== RESUMEN FINAL ===`);
		console.log(`✓ Exitosos: ${results.length}`);
		console.log(`✗ Errores: ${errors.length}`);

		const statusCode = errors.length > 0 ? (results.length > 0 ? 207 : 400) : 200;

		return res.status(statusCode).json({
			success: errors.length === 0,
			message: `Proceso de reseteo de inventario completado para la ubicación: ${targetLocation.name}`,
			location: {
				id: targetLocation.id,
				name: targetLocation.name
			},
			total_products: allProducts.length,
			total_items: allInventoryItemIds.length,
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
			stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
		});
	}
};

module.exports = {
	updateInventoryGraphQL,
	getShopifyLocations,
	resetAllInventoryToZero,
};
