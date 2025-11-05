const { graphqlClient } = require('../config/shopify');

// Create products using GraphQL Admin API
const createProductsGraphQL = async (req, res) => {
	try {
		const { products } = req.body;

		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({
				success: false,
				error: 'Products must be a non-empty array',
			});
		}

		const results = [];

		for (const product of products) {
			try {
				// Primera mutación: Crear el producto sin imágenes
				const createProductMutation = `
          mutation productCreate($input: ProductInput!) {
            productCreate(input: $input) {
              product {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                status
                variants(first: 10) {
                  edges {
                    node {
                      id
                      sku
                      price
                      inventoryQuantity
                      selectedOptions {
                        name
                        value
                      }
                    }
                  }
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

				// Preparar las variantes
				const variants = product.variants.map((variant) => ({
					price: variant.price.toString(),
					sku: variant.sku,
					inventoryManagement: 'SHOPIFY',
					inventoryPolicy: 'DENY',
					options: [variant.option1, variant.option2].filter(Boolean),
				}));

				// Variables para la primera mutación
				const createProductVariables = {
					input: {
						title: product.title,
						descriptionHtml: product.description,
						vendor: product.vendor,
						productType: product.category,
						variants: variants,
						options: product.options || [],
						status: 'ACTIVE',
						tags: product.tags || [],
					},
				};

				console.log(
					'Create Product Mutation:',
					createProductMutation
				);
				console.log(
					'Create Product Variables:',
					JSON.stringify(createProductVariables, null, 2)
				);

				// Ejecutar la primera mutación para crear el producto
				const createResponse = await graphqlClient.query({
					data: {
						query: createProductMutation,
						variables: createProductVariables,
					},
				});

				console.log(
					'Create Product Response:',
					JSON.stringify(createResponse.body, null, 2)
				);

				if (
					createResponse.body.data?.productCreate?.userErrors
						?.length > 0
				) {
					throw new Error(
						`Error creating product: ${JSON.stringify(
							createResponse.body.data.productCreate.userErrors
						)}`
					);
				}

				const createdProduct =
					createResponse.body.data.productCreate.product;
				const createdVariants = createdProduct.variants.edges.map(
					(edge) => edge.node
				);

				// Si hay imágenes, agregarlas usando stagedUploadsCreate y productCreateMedia
				if (product.images && product.images.length > 0) {
					for (let i = 0; i < product.images.length; i++) {
						const image = product.images[i];

						// Primero crear un staged upload
						const stagedUploadMutation = `
              mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
                stagedUploadsCreate(input: $input) {
                  stagedTargets {
                    resourceUrl
                    url
                    parameters {
                      name
                      value
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;

						const filename = image.url.split('/').pop();
						const mimeType = filename.toLowerCase().endsWith('.webp')
							? 'image/webp'
							: 'image/jpeg';

						const stagedUploadVariables = {
							input: [
								{
									resource: 'PRODUCT_IMAGE',
									filename: filename,
									mimeType: mimeType,
									httpMethod: 'POST',
								},
							],
						};

						console.log(
							'Staged Upload Mutation:',
							stagedUploadMutation
						);
						console.log(
							'Staged Upload Variables:',
							JSON.stringify(stagedUploadVariables, null, 2)
						);

						const stagedUploadResponse = await graphqlClient.query({
							data: {
								query: stagedUploadMutation,
								variables: stagedUploadVariables,
							},
						});

						console.log(
							'Staged Upload Response:',
							JSON.stringify(stagedUploadResponse.body, null, 2)
						);

						if (
							stagedUploadResponse.body.data?.stagedUploadsCreate
								?.userErrors?.length > 0
						) {
							console.error(
								'Error in staged upload:',
								stagedUploadResponse.body.data.stagedUploadsCreate
									.userErrors
							);
							continue;
						}

						// Luego crear el media
						const createMediaMutation = `
              mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
                productCreateMedia(media: $media, productId: $productId) {
                  media {
                    ... on MediaImage {
                      id
                      image {
                        url
                      }
                    }
                  }
                  mediaUserErrors {
                    field
                    message
                  }
                }
              }
            `;

						const createMediaVariables = {
							media: [
								{
									originalSource: image.url,
									mediaContentType: 'IMAGE',
									alt: image.alt || '',
								},
							],
							productId: createdProduct.id,
						};

						console.log(
							'Create Media Mutation:',
							createMediaMutation
						);
						console.log(
							'Create Media Variables:',
							JSON.stringify(createMediaVariables, null, 2)
						);

						const createMediaResponse = await graphqlClient.query({
							data: {
								query: createMediaMutation,
								variables: createMediaVariables,
							},
						});

						console.log(
							'Create Media Response:',
							JSON.stringify(createMediaResponse.body, null, 2)
						);

						if (
							createMediaResponse.body.data?.productCreateMedia
								?.mediaUserErrors?.length > 0
						) {
							console.error(
								'Error creating media:',
								createMediaResponse.body.data.productCreateMedia
									.mediaUserErrors
							);
							continue;
						}

						// Asociar la imagen con la variante específica
						if (
							image.variantIndex !== undefined &&
							createdVariants[image.variantIndex]
						) {
							// Primero obtener la imagen procesada
							const getMediaQuery = `
                query getNode($id: ID!) {
                  node(id: $id) {
                    ... on MediaImage {
                      id
                      image {
                        id
                        url
                      }
                      status
                    }
                  }
                }
              `;

							// Esperar un momento para que la imagen se procese
							await new Promise((resolve) =>
								setTimeout(resolve, 3000)
							);

							const mediaId =
								createMediaResponse.body.data.productCreateMedia
									.media[0].id;

							const getMediaResponse = await graphqlClient.query({
								data: {
									query: getMediaQuery,
									variables: {
										id: mediaId,
									},
								},
							});

							console.log(
								'Get Media Response:',
								JSON.stringify(getMediaResponse.body, null, 2)
							);

							if (getMediaResponse.body.data?.node?.image?.id) {
								const updateVariantMutation = `
                  mutation productVariantUpdate($input: ProductVariantInput!) {
                    productVariantUpdate(input: $input) {
                      productVariant {
                        id
                        image {
                          id
                          url
                        }
                      }
                      userErrors {
                        field
                        message
                      }
                    }
                  }
                `;

								const variantId =
									createdVariants[image.variantIndex].id;
								const imageId =
									getMediaResponse.body.data.node.image.id;

								const updateVariantVariables = {
									input: {
										id: variantId,
										imageId: imageId,
									},
								};

								console.log(
									'Update Variant Mutation:',
									updateVariantMutation
								);
								console.log(
									'Update Variant Variables:',
									JSON.stringify(updateVariantVariables, null, 2)
								);

								const updateVariantResponse =
									await graphqlClient.query({
										data: {
											query: updateVariantMutation,
											variables: updateVariantVariables,
										},
									});

								console.log(
									'Update Variant Response:',
									JSON.stringify(updateVariantResponse.body, null, 2)
								);

								if (
									updateVariantResponse.body.data
										?.productVariantUpdate?.userErrors?.length > 0
								) {
									console.error(
										'Error updating variant:',
										updateVariantResponse.body.data
											.productVariantUpdate.userErrors
									);
								}
							} else {
								console.error(
									'Image not yet processed or unavailable'
								);
							}
						}
					}
				}

				results.push(createdProduct);
			} catch (createError) {
				console.error(
					'Error processing individual product creation:',
					createError
				);
				throw createError;
			}
		}

		return res.json({ success: true, products: results });
	} catch (error) {
		console.error('Shopify GraphQL API Error:', error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};

// Update product variant prices using GraphQL Admin API
const updateVariantPricesGraphQL = async (req, res) => {
	try {
		const { price_updates } = req.body;

		if (!Array.isArray(price_updates) || price_updates.length === 0) {
			return res.status(400).json({
				success: false,
				error: 'Price updates must be a non-empty array',
			});
		}

		const results = [];

		for (const update of price_updates) {
			if (
				!update.shopify_variant_id ||
				update.compare_at_price === undefined
			) {
				return res.status(400).json({
					success: false,
					error:
						'Each update must have shopify_variant_id and compare_at_price',
				});
			}

			console.log('Processing GraphQL price update:', {
				variant_id: update.shopify_variant_id,
				compare_at_price: update.compare_at_price,
			});

			try {
				// GraphQL mutation para actualizar el precio de la variante
				const mutation = `
          mutation productVariantUpdate($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
              productVariant {
                id
                price
                compareAtPrice
                sku
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

				// Variables para la mutación
				const variables = {
					input: {
						id: `gid://shopify/ProductVariant/${update.shopify_variant_id}`,
						compareAtPrice: update.compare_at_price.toString(),
					},
				};

				console.log(
					'Sending GraphQL mutation with variables:',
					variables
				);

				// Ejecutar la mutación usando el cliente GraphQL configurado
				const response = await graphqlClient.query({
					data: {
						query: mutation,
						variables: variables,
					},
				});

				console.log('GraphQL response:', response.body);

				// Verificar si hay errores
				if (
					response.body.data.productVariantUpdate.userErrors.length >
					0
				) {
					const errors =
						response.body.data.productVariantUpdate.userErrors;
					console.error('GraphQL user errors:', errors);
					throw new Error(
						`GraphQL errors: ${JSON.stringify(errors)}`
					);
				}

				// Agregar el resultado
				results.push(
					response.body.data.productVariantUpdate.productVariant
				);
			} catch (updateError) {
				console.error(
					'Error processing individual GraphQL update:',
					updateError
				);
				throw updateError;
			}
		}

		return res.json({ success: true, results });
	} catch (error) {
		console.error('Shopify GraphQL API Error:', error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};

// Create product with variants and media in a single mutation
const createProductWithMediaGraphQL = async (req, res) => {
	try {
		const { product } = req.body;

		if (!product) {
			return res.status(400).json({
				success: false,
				error: 'Product data is required',
			});
		}

		const createProductMutation = `
      mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            id
            title
            handle
            variants(first: 10) {
              edges {
                node {
                  id
                  sku
                  price
                  selectedOptions {
                    name
                    value
                  }
                  media(first: 10) {
                    edges {
                      node {
                        ... on MediaImage {
                          id
                          alt
                          image {
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

		// Preparar los medios
		const media = product.images.map((image) => ({
			mediaContentType: 'IMAGE',
			originalSource: image.url,
			alt: image.alt || '',
		}));

		// Preparar las variantes con sus imágenes asociadas
		const variants = product.variants.map((variant) => ({
			price: variant.price.toString(),
			sku: variant.sku,
			inventoryManagement: 'SHOPIFY',
			inventoryPolicy: 'DENY',
			options: variant.options,
			mediaSrc: variant.imageUrls || [],
		}));

		// Variables para la mutación
		const variables = {
			media: media,
			input: {
				title: product.title,
				descriptionHtml: product.description,
				vendor: product.vendor,
				productType: product.category,
				options: product.options || [],
				variants: variants,
				status: 'ACTIVE',
				tags: product.tags || [],
				published: true,
			},
		};

		console.log(
			'Create Product with Media Variables:',
			JSON.stringify(variables, null, 2)
		);

		const response = await graphqlClient.query({
			data: {
				query: createProductMutation,
				variables: variables,
			},
		});

		console.log(
			'Create Product with Media Response:',
			JSON.stringify(response.body, null, 2)
		);

		if (response.body.data?.productCreate?.userErrors?.length > 0) {
			throw new Error(
				`Error creating product: ${JSON.stringify(
					response.body.data.productCreate.userErrors
				)}`
			);
		}

		return res.json({
			success: true,
			product: response.body.data.productCreate.product,
		});
	} catch (error) {
		console.error('Shopify GraphQL API Error:', error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};

// Delete product using GraphQL Admin API
const deleteProductGraphQL = async (req, res) => {
	try {
		const { product_id } = req.body;

		if (!product_id) {
			return res.status(400).json({
				success: false,
				error: 'Product ID is required',
			});
		}

		const deleteProductMutation = `
      mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          shop {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

		const variables = {
			input: {
				id: product_id,
			},
		};

		console.log('Delete Product Mutation:', deleteProductMutation);
		console.log(
			'Delete Product Variables:',
			JSON.stringify(variables, null, 2)
		);

		const response = await graphqlClient.query({
			data: {
				query: deleteProductMutation,
				variables: variables,
			},
		});

		console.log(
			'Delete Product Response:',
			JSON.stringify(response.body, null, 2)
		);

		if (response.body.data?.productDelete?.userErrors?.length > 0) {
			throw new Error(
				`Error deleting product: ${JSON.stringify(
					response.body.data.productDelete.userErrors
				)}`
			);
		}

		return res.json({
			success: true,
			deletedProductId:
				response.body.data.productDelete.deletedProductId,
		});
	} catch (error) {
		console.error('Shopify GraphQL API Error:', error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};

// Update variant media (add or remove images)
const updateVariantMedia = async (req, res) => {
	try {
		const { variant_id, images } = req.body;

		if (!variant_id) {
			return res.status(400).json({
				success: false,
				error: 'Variant ID is required',
			});
		}

		// Asegurar que el ID tenga el formato correcto
		const formattedVariantId = variant_id.startsWith('gid://')
			? variant_id
			: `gid://shopify/ProductVariant/${variant_id}`;

		if (!images || !Array.isArray(images)) {
			return res.status(400).json({
				success: false,
				error: 'Images array is required',
			});
		}

		// Primero obtener la variante actual
		const getVariantQuery = `
      query getVariant($id: ID!) {
        productVariant(id: $id) {
          id
          product {
            id
          }
          media(first: 10) {
            edges {
              node {
                ... on MediaImage {
                  id
                  image {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

		console.log('Getting variant with ID:', formattedVariantId);

		const getVariantResponse = await graphqlClient.query({
			data: {
				query: getVariantQuery,
				variables: {
					id: formattedVariantId,
				},
			},
		});

		console.log(
			'Get Variant Response:',
			JSON.stringify(getVariantResponse.body, null, 2)
		);

		if (getVariantResponse.body.errors) {
			throw new Error(
				`GraphQL errors: ${JSON.stringify(
					getVariantResponse.body.errors
				)}`
			);
		}

		if (!getVariantResponse.body.data?.productVariant) {
			throw new Error('Variant not found');
		}

		const variant = getVariantResponse.body.data.productVariant;
		const productId = variant.product.id;

		// Eliminar imágenes existentes si se especifica
		if (images.length === 0) {
			const deleteMediaMutation = `
        mutation productDeleteMedia($mediaIds: [ID!]!, $productId: ID!) {
          productDeleteMedia(mediaIds: $mediaIds, productId: $productId) {
            deletedMediaIds
            userErrors {
              field
              message
            }
          }
        }
      `;

			const mediaIds = variant.media.edges.map(
				(edge) => edge.node.id
			);

			console.log('Deleting media with IDs:', mediaIds);

			const deleteMediaResponse = await graphqlClient.query({
				data: {
					query: deleteMediaMutation,
					variables: {
						mediaIds: mediaIds,
						productId: productId,
					},
				},
			});

			if (deleteMediaResponse.body.errors) {
				throw new Error(
					`Error deleting media: ${JSON.stringify(
						deleteMediaResponse.body.errors
					)}`
				);
			}
		} else {
			// Agregar nuevas imágenes
			const createMediaMutation = `
        mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
          productCreateMedia(media: $media, productId: $productId) {
            media {
              ... on MediaImage {
                id
                image {
                  id
                  url
                }
              }
            }
            mediaUserErrors {
              field
              message
            }
          }
        }
      `;

			const media = images.map((image) => ({
				mediaContentType: 'IMAGE',
				originalSource: image.url,
				alt: image.alt || '',
			}));

			console.log('Creating media with variables:', {
				media,
				productId,
			});

			const createMediaResponse = await graphqlClient.query({
				data: {
					query: createMediaMutation,
					variables: {
						media: media,
						productId: productId,
					},
				},
			});

			console.log(
				'Create Media Response:',
				JSON.stringify(createMediaResponse.body, null, 2)
			);

			if (createMediaResponse.body.errors) {
				throw new Error(
					`Error creating media: ${JSON.stringify(
						createMediaResponse.body.errors
					)}`
				);
			}

			if (
				createMediaResponse.body.data?.productCreateMedia
					?.mediaUserErrors?.length > 0
			) {
				throw new Error(
					`Error creating media: ${JSON.stringify(
						createMediaResponse.body.data.productCreateMedia
							.mediaUserErrors
					)}`
				);
			}

			// Esperar un momento para que la imagen se procese
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Obtener el ID de la imagen
			const getMediaQuery = `
        query getMedia($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              id
              image {
                id
                url
              }
            }
          }
        }
      `;

			const mediaId =
				createMediaResponse.body.data.productCreateMedia.media[0].id;

			console.log('Getting media details for:', mediaId);

			const getMediaResponse = await graphqlClient.query({
				data: {
					query: getMediaQuery,
					variables: {
						id: mediaId,
					},
				},
			});

			console.log(
				'Get Media Response:',
				JSON.stringify(getMediaResponse.body, null, 2)
			);

			if (getMediaResponse.body.errors) {
				throw new Error(
					`Error getting media: ${JSON.stringify(
						getMediaResponse.body.errors
					)}`
				);
			}

			if (!getMediaResponse.body.data?.node?.id) {
				throw new Error('Media not yet processed or unavailable');
			}

			// Usar el ID del MediaImage directamente
			const mediaImageId = getMediaResponse.body.data.node.id;

			// Asociar las nuevas imágenes con la variante
			const updateVariantMutation = `
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              media(first: 1) {
                edges {
                  node {
                    ... on MediaImage {
                      id
                      image {
                        url
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

			console.log('Updating variant with:', {
				variantId: formattedVariantId,
				mediaId: mediaImageId,
			});

			const updateVariantResponse = await graphqlClient.query({
				data: {
					query: updateVariantMutation,
					variables: {
						input: {
							id: formattedVariantId,
							mediaId: mediaImageId,
						},
					},
				},
			});

			console.log(
				'Update Variant Response:',
				JSON.stringify(updateVariantResponse.body, null, 2)
			);

			if (updateVariantResponse.body.errors) {
				throw new Error(
					`Error updating variant: ${JSON.stringify(
						updateVariantResponse.body.errors
					)}`
				);
			}

			if (
				updateVariantResponse.body.data?.productVariantUpdate
					?.userErrors?.length > 0
			) {
				throw new Error(
					`Error updating variant: ${JSON.stringify(
						updateVariantResponse.body.data.productVariantUpdate
							.userErrors
					)}`
				);
			}
		}

		return res.json({
			success: true,
			message:
				images.length === 0
					? 'Variant images removed successfully'
					: 'Variant images updated successfully',
		});
	} catch (error) {
		console.error('Shopify GraphQL API Error:', error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};

// Delete variant
const deleteVariant = async (req, res) => {
	console.log('Eliminar');
	const axios = require('axios');
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(
		/^https?:\/\//,
		''
	);

	// Configuración de rate limiting
	const REQUESTS_PER_SECOND = 35;
	const DELAY_BETWEEN_REQUESTS = Math.ceil(
		1000 / REQUESTS_PER_SECOND
	);

	try {
		const { variant_id } = req.body;
		const variants = [{ variant_id: variant_id }];
		console.log('Variants to delete:', variants);
		if (!Array.isArray(variants) || variants.length === 0) {
			return res.status(400).json({
				success: false,
				error:
					'Se requiere un array de variants con al menos un elemento',
			});
		}

		console.log(`\n=== ELIMINANDO VARIANTES ===`);
		console.log(`Total de variantes a eliminar: ${variants.length}`);

		const results = [];
		const errors = [];
		const sleep = (ms) =>
			new Promise((resolve) => setTimeout(resolve, ms));

		for (let i = 0; i < variants.length; i++) {
			const variantData = variants[i];
			const variantGid = variantData.variant_id;

			// Validar formato del GID
			if (
				!variantGid ||
				!variantGid.startsWith('gid://shopify/ProductVariant/')
			) {
				errors.push({
					index: i,
					variant_id: variantGid,
					error:
						'Formato de variant_id inválido. Debe ser gid://shopify/ProductVariant/XXXXXX',
				});
				continue;
			}

			// Extraer ID numérico del GID
			const variantId = variantGid.replace(
				'gid://shopify/ProductVariant/',
				''
			);

			try {
				console.log(
					`\n[${i + 1}/${variants.length}] Procesando variante:`
				);
				console.log(`  - Variant ID: ${variantId}`);

				// PASO 1: Obtener información de la variante antes de eliminarla
				const getVariantUrl = `https://${shopUrl}/admin/api/2024-10/variants/${variantId}.json`;
				let variantInfo = null;
				let imageIdToDelete = null;
				let productId = null;

				try {
					const variantResp = await axios.get(getVariantUrl, {
						headers: {
							'X-Shopify-Access-Token':
								process.env.SHOPIFY_ACCESS_TOKEN,
							'Content-Type': 'application/json',
						},
					});

					variantInfo = variantResp.data.variant;
					imageIdToDelete = variantInfo.image_id;
					productId = variantInfo.product_id;

					console.log(`  - Product ID: ${productId}`);
					console.log(`  - SKU: ${variantInfo.sku}`);
					console.log(
						`  - Image ID: ${imageIdToDelete || 'ninguna'}`
					);

					await sleep(DELAY_BETWEEN_REQUESTS);
				} catch (getError) {
					console.error(
						`  ✗ Error obteniendo información de la variante:`,
						getError.response?.data || getError.message
					);
					throw new Error(
						'No se pudo obtener información de la variante'
					);
				}

				// PASO 2: Verificar que no sea la única variante del producto
				const getProductUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}.json?fields=id,variants`;

				try {
					const productResp = await axios.get(getProductUrl, {
						headers: {
							'X-Shopify-Access-Token':
								process.env.SHOPIFY_ACCESS_TOKEN,
							'Content-Type': 'application/json',
						},
					});

					const totalVariants =
						productResp.data.product.variants?.length || 0;

					if (totalVariants <= 1) {
						errors.push({
							index: i,
							variant_id: variantGid,
							product_id: productId,
							sku: variantInfo.sku,
							error:
								'No se puede eliminar la única variante del producto. Elimine el producto completo en su lugar.',
						});
						console.log(
							`  ⚠ No se puede eliminar: es la única variante`
						);
						continue;
					}

					console.log(
						`  - Total de variantes en producto: ${totalVariants}`
					);
					await sleep(DELAY_BETWEEN_REQUESTS);
				} catch (productError) {
					console.error(
						`  ✗ Error verificando producto:`,
						productError.response?.data || productError.message
					);
				}

				// PASO 3: Eliminar la variante
				const deleteVariantUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}/variants/${variantId}.json`;

				try {
					await axios.delete(deleteVariantUrl, {
						headers: {
							'X-Shopify-Access-Token':
								process.env.SHOPIFY_ACCESS_TOKEN,
						},
					});

					console.log(`  ✓ Variante eliminada`);
					await sleep(DELAY_BETWEEN_REQUESTS);
				} catch (deleteError) {
					throw new Error(
						`Error eliminando variante: ${
							deleteError.response?.data?.errors ||
							deleteError.message
						}`
					);
				}

				// PASO 4: Verificar si la imagen está siendo usada por otras variantes
				let imageDeleted = false;
				if (imageIdToDelete && productId) {
					try {
						// Obtener todas las variantes restantes del producto
						const remainingVariantsUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}/variants.json`;
						const remainingResp = await axios.get(
							remainingVariantsUrl,
							{
								headers: {
									'X-Shopify-Access-Token':
										process.env.SHOPIFY_ACCESS_TOKEN,
									'Content-Type': 'application/json',
								},
							}
						);

						const remainingVariants =
							remainingResp.data.variants || [];
						const imageStillInUse = remainingVariants.some(
							(v) => v.image_id === imageIdToDelete
						);

						await sleep(DELAY_BETWEEN_REQUESTS);

						// Solo eliminar la imagen si no está siendo usada por otras variantes
						if (!imageStillInUse) {
							const deleteImageUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}/images/${imageIdToDelete}.json`;

							await axios.delete(deleteImageUrl, {
								headers: {
									'X-Shopify-Access-Token':
										process.env.SHOPIFY_ACCESS_TOKEN,
								},
							});

							console.log(
								`  ✓ Imagen eliminada (ID: ${imageIdToDelete})`
							);
							imageDeleted = true;
						} else {
							console.log(
								`  ℹ Imagen conservada (en uso por otras variantes)`
							);
						}

						await sleep(DELAY_BETWEEN_REQUESTS);
					} catch (imageError) {
						console.error(
							`  ⚠ Error al eliminar imagen:`,
							imageError.response?.data || imageError.message
						);
						// No marcamos como error porque la variante sí se eliminó
					}
				}

				results.push({
					index: i,
					variant_id: variantGid,
					numeric_variant_id: variantId,
					product_id: productId,
					sku: variantInfo.sku,
					success: true,
					variant_deleted: true,
					image_deleted: imageDeleted,
					image_id: imageIdToDelete,
				});
			} catch (deleteError) {
				// Manejar rate limiting
				if (deleteError.response?.status === 429) {
					console.error(`  ✗ Rate limit alcanzado, esperando...`);
					const retryAfter =
						parseInt(
							deleteError.response.headers['retry-after'] || '2'
						) * 1000;
					await sleep(retryAfter);
					i--; // Reintentar
					continue;
				}

				console.error(`  ✗ Error:`, deleteError.message);

				errors.push({
					index: i,
					variant_id: variantGid,
					error: deleteError.message,
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
			total: variants.length,
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

const updateVariant = async (req, res) => {
	console.log('caso 1');
	const axios = require('axios');
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(
		/^https?:\/\//,
		''
	);

	try {
		const { shopify_id, variant_id, price, sku, options, imageUrls } =
			req.body;

		// Validaciones
		if (!shopify_id || !variant_id) {
			return res.status(400).json({
				success: false,
				error: 'Se requieren los campos shopify_id y variant_id',
			});
		}

		console.log(`\n=== ACTUALIZANDO VARIANTE ===`);
		console.log(`Product ID: ${shopify_id}`);
		console.log(`Variant ID: ${variant_id}`);
		console.log(`SKU: ${sku || 'sin cambios'}`);
		console.log(`Price: ${price || 'sin cambios'}`);
		console.log(
			`Options: ${options ? options.join(', ') : 'sin cambios'}`
		);

		const sleep = (ms) =>
			new Promise((resolve) => setTimeout(resolve, ms));

		// PASO 1: Construir objeto de actualización de variante
		const variantData = {
			variant: {
				id: variant_id,
			},
		};

		// Agregar solo los campos que vienen en el request
		if (price !== undefined) {
			variantData.variant.price = String(price);
		}

		if (sku !== undefined) {
			variantData.variant.sku = sku;
		}

		if (Array.isArray(options)) {
			if (options[0] !== undefined)
				variantData.variant.option1 = options[0];
			if (options[1] !== undefined)
				variantData.variant.option2 = options[1];
			if (options[2] !== undefined)
				variantData.variant.option3 = options[2];
		}

		// PASO 2: Manejar imágenes si se proporcionan
		let imageId = null;
		if (Array.isArray(imageUrls) && imageUrls.length > 0) {
			console.log(`\n[1/3] Procesando imagen para la variante...`);

			try {
				// Obtener las imágenes actuales del producto
				const getImagesUrl = `https://${shopUrl}/admin/api/2024-10/products/${shopify_id}/images.json`;
				const imagesResp = await axios.get(getImagesUrl, {
					headers: {
						'X-Shopify-Access-Token':
							process.env.SHOPIFY_ACCESS_TOKEN,
						'Content-Type': 'application/json',
					},
				});

				const existingImages = imagesResp.data.images || [];
				const firstImageUrl = imageUrls[0];

				// Buscar si la imagen ya existe en el producto
				let existingImage = existingImages.find(
					(img) => img.src === firstImageUrl
				);

				if (existingImage) {
					imageId = existingImage.id;
					console.log(
						`  ✓ Imagen ya existe en el producto (ID: ${imageId})`
					);
				} else {
					// Crear nueva imagen en el producto
					console.log(`  → Subiendo nueva imagen al producto...`);

					const createImageUrl = `https://${shopUrl}/admin/api/2024-10/products/${shopify_id}/images.json`;
					const imageResp = await axios.post(
						createImageUrl,
						{
							image: {
								src: firstImageUrl,
								alt: sku || '',
							},
						},
						{
							headers: {
								'X-Shopify-Access-Token':
									process.env.SHOPIFY_ACCESS_TOKEN,
								'Content-Type': 'application/json',
							},
						}
					);

					imageId = imageResp.data.image.id;
					console.log(
						`  ✓ Imagen subida exitosamente (ID: ${imageId})`
					);
				}

				// Asignar la imagen a la variante
				if (imageId) {
					variantData.variant.image_id = imageId;
				}

				await sleep(100);
			} catch (imageError) {
				console.error(
					`  ⚠ Error procesando imagen:`,
					imageError.response?.data || imageError.message
				);
				// Continuar con la actualización aunque falle la imagen
			}
		}

		// PASO 3: Actualizar la variante
		console.log(`\n[2/3] Actualizando datos de la variante...`);

		const updateVariantUrl = `https://${shopUrl}/admin/api/2024-10/variants/${variant_id}.json`;

		let updatedVariant = null;
		try {
			const variantResp = await axios.put(
				updateVariantUrl,
				variantData,
				{
					headers: {
						'X-Shopify-Access-Token':
							process.env.SHOPIFY_ACCESS_TOKEN,
						'Content-Type': 'application/json',
					},
				}
			);

			updatedVariant = variantResp.data.variant;
			console.log(`  ✓ Variante actualizada exitosamente`);
		} catch (variantError) {
			console.error(
				`  ✗ Error actualizando variante:`,
				variantError.response?.data || variantError.message
			);
			return res.status(400).json({
				success: false,
				error: 'Error actualizando variante',
				details: variantError.response?.data,
			});
		}

		// PASO 4: Obtener información completa de la variante actualizada
		console.log(`\n[3/3] Obteniendo información actualizada...`);

		try {
			const getVariantUrl = `https://${shopUrl}/admin/api/2024-10/variants/${variant_id}.json`;
			const finalResp = await axios.get(getVariantUrl, {
				headers: {
					'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
					'Content-Type': 'application/json',
				},
			});

			updatedVariant = finalResp.data.variant;
		} catch (getError) {
			console.error(
				`  ⚠ Error obteniendo info actualizada:`,
				getError.message
			);
			// Usar la respuesta anterior si falla
		}

		console.log(`\n=== VARIANTE ACTUALIZADA EXITOSAMENTE ===\n`);

		return res.json({
			success: true,
			variant: {
				shopify_variant_id: updatedVariant.id,
				shopify_id: updatedVariant.product_id,
				sku: updatedVariant.sku,
				price: updatedVariant.price,
				inventory_item_id: updatedVariant.inventory_item_id,
				inventory_quantity: updatedVariant.inventory_quantity,
				image_id: updatedVariant.image_id,
				options: [
					updatedVariant.option1,
					updatedVariant.option2,
					updatedVariant.option3,
				].filter(Boolean),
				barcode: updatedVariant.barcode,
				weight: updatedVariant.weight,
				weight_unit: updatedVariant.weight_unit,
				shopify_created_at: updatedVariant.created_at,
				shopify_updated_at: updatedVariant.updated_at,
			},
			updated_fields: {
				price: price !== undefined,
				sku: sku !== undefined,
				options: Array.isArray(options),
				image: imageId !== null,
			},
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

// Create variant using GraphQL Admin API
const createVariantGraphQL = async (req, res) => {
	try {
		const { product_id, variant, images } = req.body;

		if (!product_id || !variant) {
			return res.status(400).json({
				success: false,
				error: 'Se requiere product_id y variant',
			});
		}

		// Asegurar que el product_id tenga el formato correcto
		const productIdString = String(product_id);
		const formattedProductId = productIdString.startsWith('gid://')
			? productIdString
			: `gid://shopify/Product/${productIdString}`;

		// Primero obtener el producto para verificar su configuración actual
		const getProductQuery = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          options {
            id
            name
            values
          }
          variants(first: 10) {
            edges {
              node {
                id
                sku
                price
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

		console.log(
			'Obteniendo información del producto:',
			formattedProductId
		);

		const getProductResponse = await graphqlClient.query({
			data: {
				query: getProductQuery,
				variables: {
					id: formattedProductId,
				},
			},
		});

		console.log(
			'Get Product Response:',
			JSON.stringify(getProductResponse.body, null, 2)
		);

		if (getProductResponse.body.errors) {
			throw new Error(
				`Error obteniendo producto: ${JSON.stringify(
					getProductResponse.body.errors
				)}`
			);
		}

		if (!getProductResponse.body.data?.product) {
			throw new Error('Producto no encontrado');
		}

		const product = getProductResponse.body.data.product;
		const existingVariants = product.variants.edges;
		const existingOptions = product.options;

		// Verificar si existe una variante "Default Title" que necesite ser eliminada
		const defaultTitleVariant = existingVariants.find((edge) => {
			const selectedOptions = edge.node.selectedOptions;
			return selectedOptions.some(
				(option) =>
					option.name === 'Title' && option.value === 'Default Title'
			);
		});

		if (defaultTitleVariant) {
			console.log(
				'Encontrada variante "Default Title", eliminándola antes de crear nuevas variantes...'
			);

			const deleteVariantMutation = `
        mutation productVariantDelete($id: ID!) {
          productVariantDelete(id: $id) {
            deletedProductVariantId
            userErrors {
              field
              message
            }
          }
        }
      `;

			const deleteVariantVariables = {
				id: defaultTitleVariant.node.id,
			};

			console.log(
				'Eliminando variante Default Title:',
				defaultTitleVariant.node.id
			);

			const deleteVariantResponse = await graphqlClient.query({
				data: {
					query: deleteVariantMutation,
					variables: deleteVariantVariables,
				},
			});

			console.log(
				'Delete Variant Response:',
				JSON.stringify(deleteVariantResponse.body, null, 2)
			);

			if (
				deleteVariantResponse.body.data?.productVariantDelete
					?.userErrors?.length > 0
			) {
				throw new Error(
					`Error eliminando variante Default Title: ${JSON.stringify(
						deleteVariantResponse.body.data.productVariantDelete
							.userErrors
					)}`
				);
			}

			console.log('Variante Default Title eliminada exitosamente');

			// Esperar un momento para que Shopify procese la eliminación
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		// Si el producto no tiene variantes, necesitamos configurar las opciones primero
		if (
			existingVariants.length === 0 ||
			(defaultTitleVariant && existingVariants.length === 1)
		) {
			console.log('Producto sin variantes, configurando opciones...');

			// Determinar las opciones necesarias basándose en la variante que se va a crear
			const requiredOptions = [];

			if (variant.option1) {
				requiredOptions.push({
					name: 'Option 1',
					values: [variant.option1],
				});
			}

			if (variant.option2) {
				requiredOptions.push({
					name: 'Option 2',
					values: [variant.option2],
				});
			}

			if (variant.option3) {
				requiredOptions.push({
					name: 'Option 3',
					values: [variant.option3],
				});
			}

			// Si no hay opciones configuradas, configurarlas
			if (
				existingOptions.length === 0 &&
				requiredOptions.length > 0
			) {
				console.log(
					'Configurando opciones del producto:',
					requiredOptions
				);

				const updateProductMutation = `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                options {
                  id
                  name
                  values
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

				const updateProductVariables = {
					input: {
						id: formattedProductId,
						options: requiredOptions.map((option) =>
							option.values.join(', ')
						),
					},
				};

				const updateProductResponse = await graphqlClient.query({
					data: {
						query: updateProductMutation,
						variables: updateProductVariables,
					},
				});

				console.log(
					'Update Product Response:',
					JSON.stringify(updateProductResponse.body, null, 2)
				);

				if (
					updateProductResponse.body.data?.productUpdate?.userErrors
						?.length > 0
				) {
					throw new Error(
						`Error configurando opciones: ${JSON.stringify(
							updateProductResponse.body.data.productUpdate.userErrors
						)}`
					);
				}

				console.log(
					'Opciones del producto configuradas exitosamente'
				);

				// Esperar un momento para que las opciones se procesen
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		} else {
			// Si el producto ya tiene variantes, verificar que las opciones coincidan
			console.log(
				'Producto con variantes existentes, verificando opciones...'
			);
			console.log('Opciones existentes:', existingOptions);
			console.log('Opciones de la variante:', {
				option1: variant.option1,
				option2: variant.option2,
				option3: variant.option3,
			});

			// Verificar si el producto tiene la opción "Default Title" (que no se puede modificar)
			const hasDefaultTitle = existingOptions.some(
				(option) =>
					option.name === 'Title' &&
					option.values.includes('Default Title')
			);

			if (hasDefaultTitle) {
				console.log(
					'Producto tiene opción "Default Title" - no se pueden modificar las opciones'
				);
				console.log(
					'Usando las opciones existentes para crear la variante'
				);

				// Para productos con "Default Title", usar las opciones existentes
				// y crear la variante con los valores disponibles
				const defaultTitleOption = existingOptions.find(
					(option) => option.name === 'Title'
				);

				if (
					defaultTitleOption &&
					defaultTitleOption.values.includes('Default Title')
				) {
					console.log('Usando "Default Title" como option1');
					variant.option1 = 'Default Title';

					// Si el producto solo tiene una opción, no usar option2 ni option3
					if (existingOptions.length === 1) {
						console.log(
							'Producto solo tiene una opción, ignorando option2 y option3'
						);
						variant.option2 = undefined;
						variant.option3 = undefined;
					}
				}
			} else {
				// Verificar y actualizar opciones si es necesario (solo si no tiene "Default Title")
				let needsUpdate = false;
				const updatedOptions = [...existingOptions];

				if (
					variant.option1 &&
					existingOptions.length > 0 &&
					!existingOptions[0].values.includes(variant.option1)
				) {
					console.log('Agregando valor a Option 1:', variant.option1);
					updatedOptions[0] = {
						...existingOptions[0],
						values: [...existingOptions[0].values, variant.option1],
					};
					needsUpdate = true;
				}

				if (
					variant.option2 &&
					existingOptions.length > 1 &&
					!existingOptions[1].values.includes(variant.option2)
				) {
					console.log('Agregando valor a Option 2:', variant.option2);
					updatedOptions[1] = {
						...existingOptions[1],
						values: [...existingOptions[1].values, variant.option2],
					};
					needsUpdate = true;
				}

				if (needsUpdate) {
					const updateProductMutation = `
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  options {
                    id
                    name
                    values
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

					const updateProductVariables = {
						input: {
							id: formattedProductId,
							options: updatedOptions.map((option) =>
								option.values.join(', ')
							),
						},
					};

					const updateProductResponse = await graphqlClient.query({
						data: {
							query: updateProductMutation,
							variables: updateProductVariables,
						},
					});

					console.log(
						'Update Product Options Response:',
						JSON.stringify(updateProductResponse.body, null, 2)
					);

					if (
						updateProductResponse.body.data?.productUpdate?.userErrors
							?.length > 0
					) {
						throw new Error(
							`Error actualizando opciones: ${JSON.stringify(
								updateProductResponse.body.data.productUpdate
									.userErrors
							)}`
						);
					}

					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}

		// Crear la variante usando GraphQL
		console.log('Creando variante con GraphQL:', variant);

		// Primero obtener las ubicaciones disponibles
		const getLocationsQuery = `
      query {
        locations(first: 10) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `;

		const locationsResponse = await graphqlClient.query({
			data: {
				query: getLocationsQuery,
			},
		});

		console.log(
			'Locations Response:',
			JSON.stringify(locationsResponse.body, null, 2)
		);

		if (locationsResponse.body.errors) {
			throw new Error(
				`Error obteniendo ubicaciones: ${JSON.stringify(
					locationsResponse.body.errors
				)}`
			);
		}

		const locations = locationsResponse.body.data.locations.edges;
		if (locations.length === 0) {
			throw new Error('No se encontraron ubicaciones disponibles');
		}

		// Usar la primera ubicación disponible
		const locationId = locations[0].node.id;
		console.log('Usando ubicación:', locationId);

		const createVariantMutation = `
      mutation productVariantCreate($input: ProductVariantInput!) {
        productVariantCreate(input: $input) {
          productVariant {
            id
            sku
            price
            inventoryQuantity
            selectedOptions {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

		const createVariantVariables = {
			input: {
				productId: formattedProductId,
				price: variant.price.toString(),
				sku: variant.sku,
				inventoryManagement: 'SHOPIFY',
				inventoryPolicy: 'DENY',
				inventoryQuantities: [
					{
						availableQuantity: variant.inventory_quantity || 0,
						locationId: locationId,
					},
				],
				options: [variant.option1, variant.option2, variant.option3]
					.filter(Boolean)
					.slice(0, existingOptions.length), // Solo enviar las opciones que existen en el producto
			},
		};

		console.log(
			'Opciones finales a enviar:',
			createVariantVariables.input.options
		);
		console.log(
			'Número de opciones en el producto:',
			existingOptions.length
		);
		console.log(
			'Create Variant Variables:',
			JSON.stringify(createVariantVariables, null, 2)
		);

		const createVariantResponse = await graphqlClient.query({
			data: {
				query: createVariantMutation,
				variables: createVariantVariables,
			},
		});

		console.log(
			'Create Variant Response:',
			JSON.stringify(createVariantResponse.body, null, 2)
		);

		if (
			createVariantResponse.body.data?.productVariantCreate
				?.userErrors?.length > 0
		) {
			throw new Error(
				`Error creando variante: ${JSON.stringify(
					createVariantResponse.body.data.productVariantCreate
						.userErrors
				)}`
			);
		}

		const createdVariant =
			createVariantResponse.body.data.productVariantCreate
				.productVariant;
		console.log('Variante creada exitosamente:', createdVariant.id);

		// Si hay imágenes, subirlas y asociarlas con la variante
		if (images && Array.isArray(images) && images.length > 0) {
			console.log('Subiendo imágenes para la variante...');

			// Crear las imágenes usando GraphQL
			const createMediaMutation = `
        mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
          productCreateMedia(media: $media, productId: $productId) {
            media {
              ... on MediaImage {
                id
                image {
                  id
                  url
                }
              }
            }
            mediaUserErrors {
              field
              message
            }
          }
        }
      `;

			const media = images.map((image) => ({
				mediaContentType: 'IMAGE',
				originalSource: image.url,
				alt: image.alt || '',
			}));

			const createMediaResponse = await graphqlClient.query({
				data: {
					query: createMediaMutation,
					variables: {
						media: media,
						productId: formattedProductId,
					},
				},
			});

			console.log(
				'Create Media Response:',
				JSON.stringify(createMediaResponse.body, null, 2)
			);

			if (
				createMediaResponse.body.data?.productCreateMedia
					?.mediaUserErrors?.length > 0
			) {
				console.error(
					'Error creando imágenes:',
					createMediaResponse.body.data.productCreateMedia
						.mediaUserErrors
				);
			} else {
				// Esperar un momento para que las imágenes se procesen
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Asociar las imágenes con la variante
				const mediaIds =
					createMediaResponse.body.data.productCreateMedia.media.map(
						(m) => m.id
					);

				if (mediaIds.length > 0) {
					const updateVariantMutation = `
            mutation productVariantUpdate($input: ProductVariantInput!) {
              productVariantUpdate(input: $input) {
                productVariant {
                  id
                  media(first: 10) {
                    edges {
                      node {
                        ... on MediaImage {
                          id
                          image {
                            url
                          }
                        }
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

					const updateVariantVariables = {
						input: {
							id: createdVariant.id,
							mediaId: mediaIds[0], // Asociar la primera imagen
						},
					};

					const updateVariantResponse = await graphqlClient.query({
						data: {
							query: updateVariantMutation,
							variables: updateVariantVariables,
						},
					});

					console.log(
						'Update Variant with Media Response:',
						JSON.stringify(updateVariantResponse.body, null, 2)
					);
				}

				console.log('Imágenes asociadas exitosamente');
			}
		}

		return res.json({
			success: true,
			variant: createdVariant,
		});
	} catch (error) {
		console.error('Error en createVariantGraphQL:', error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};
const createProductFullFlow = async (req, res) => {
	const axios = require('axios');
	const shopUrl = process.env.SHOPIFY_SHOP_URL.replace(
		/^https?:\/\//,
		''
	);
	try {
		const { media, input } = req.body || {};

		// Validaciones
		if (!input || !input.title) {
			return res.status(400).json({
				success: false,
				error: 'Se requiere input.title',
			});
		}

		if (
			!Array.isArray(input.variants) ||
			input.variants.length === 0
		) {
			return res.status(400).json({
				success: false,
				error: 'Se requiere al menos una variante',
			});
		}

		console.log('=== INICIANDO CREACIÓN DE PRODUCTO ===');
		console.log('Título:', input.title);
		console.log('Variantes a crear:', input.variants.length);
		console.log('Medios a subir:', media?.length || 0);

		// PASO 1: Crear el producto base
		console.log('\n[1/5] Creando producto base...');
		const productCreateMutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { 
            id 
            title 
            legacyResourceId
          }
          userErrors { field message }
        }
      }
    `;

		const productInput = {
			title: input.title,
			descriptionHtml: input.descriptionHtml || undefined,
			vendor: input.vendor || undefined,
			productType: input.productType || undefined,
			status: input.status || 'ACTIVE',
			tags: Array.isArray(input.tags) ? input.tags : undefined,
		};

		const createResp = await graphqlClient.query({
			data: {
				query: productCreateMutation,
				variables: { input: productInput },
			},
		});

		const userErrors =
			createResp.body?.data?.productCreate?.userErrors;
		if (userErrors && userErrors.length > 0) {
			console.error('Errores al crear producto:', userErrors);
			return res.status(400).json({
				success: false,
				error: 'Error al crear producto',
				details: userErrors,
			});
		}

		const productGid =
			createResp.body?.data?.productCreate?.product?.id;
		const productId =
			createResp.body?.data?.productCreate?.product?.legacyResourceId;

		if (!productGid || !productId) {
			return res.status(500).json({
				success: false,
				error: 'No se obtuvo el ID del producto',
			});
		}

		console.log('✓ Producto creado:', productId);

		// PASO 2: Subir imágenes al producto
		let mediaMap = new Map(); // Map<originalSource, numericImageId>

		if (Array.isArray(media) && media.length > 0) {
			console.log('\n[2/5] Subiendo imágenes del producto...');

			const productCreateMediaMutation = `
        mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media { 
              ... on MediaImage { 
                id 
                image { url }
              } 
            }
            mediaUserErrors { field message }
          }
        }
      `;

			const createMediaResp = await graphqlClient.query({
				data: {
					query: productCreateMediaMutation,
					variables: {
						productId: productGid,
						media: media.map((m) => ({
							mediaContentType: m.mediaContentType || 'IMAGE',
							originalSource: m.originalSource,
							alt: m.alt || '',
						})),
					},
				},
			});

			const mediaErrors =
				createMediaResp.body?.data?.productCreateMedia
					?.mediaUserErrors;
			if (mediaErrors && mediaErrors.length > 0) {
				console.error('Errores al subir medios:', mediaErrors);
			}

			const createdMedia =
				createMediaResp.body?.data?.productCreateMedia?.media || [];

			// Obtener los IDs numéricos de las imágenes mediante REST API
			try {
				const getProductUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}.json`;
				const productResp = await axios.get(getProductUrl, {
					headers: {
						'X-Shopify-Access-Token':
							process.env.SHOPIFY_ACCESS_TOKEN,
						'Content-Type': 'application/json',
					},
				});

				const images = productResp.data?.product?.images || [];

				// Mapear las URLs originales con los IDs numéricos de imagen
				media.forEach((m, idx) => {
					if (images[idx]) {
						mediaMap.set(m.originalSource, images[idx].id);
						console.log(
							`✓ Imagen ${idx + 1}: ${m.originalSource} → ID: ${
								images[idx].id
							}`
						);
					}
				});
			} catch (imgError) {
				console.error(
					'Error obteniendo IDs de imágenes:',
					imgError.message
				);
			}
		}

		// PASO 3: Configurar opciones del producto
		console.log('\n[3/5] Configurando opciones del producto...');

		// Siempre configurar opciones si se especifican, incluso con 1 variante
		const productOptions = input.options || ['Variante'];

		try {
			const updateProductUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}.json`;
			await axios.put(
				updateProductUrl,
				{
					product: {
						id: productId,
						options: productOptions.map((name) => ({ name })),
					},
				},
				{
					headers: {
						'X-Shopify-Access-Token':
							process.env.SHOPIFY_ACCESS_TOKEN,
						'Content-Type': 'application/json',
					},
				}
			);
			console.log(
				'✓ Opciones configuradas:',
				productOptions.join(', ')
			);

			// Esperar para que se procesen las opciones
			await new Promise((resolve) => setTimeout(resolve, 1500));
		} catch (optionError) {
			console.error(
				'Error configurando opciones:',
				optionError.response?.data || optionError.message
			);
		}

		// PASO 4: Obtener la variante "Default Title" para actualizarla
		console.log('\n[4/5] Gestionando variante por defecto...');
		let defaultVariantId = null;

		try {
			const getVariantsUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}/variants.json`;
			const variantsResp = await axios.get(getVariantsUrl, {
				headers: {
					'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
					'Content-Type': 'application/json',
				},
			});

			const defaultVariant = variantsResp.data?.variants?.find(
				(v) => v.title === 'Default Title' || v.title === input.title
			);

			if (defaultVariant) {
				defaultVariantId = defaultVariant.id;
				console.log(
					'✓ Variante por defecto encontrada:',
					defaultVariantId
				);

				// Si solo hay una variante, actualizar la existente en lugar de crear y eliminar
				if (input.variants.length === 1) {
					console.log('  → Actualizando variante existente...');
					const v = input.variants[0];
					const optionsValues = Array.isArray(v.options)
						? v.options
						: [];

					let imageId = null;
					if (Array.isArray(v.mediaSrc) && v.mediaSrc.length > 0) {
						const firstMediaSrc = v.mediaSrc[0];
						if (mediaMap.has(firstMediaSrc)) {
							imageId = mediaMap.get(firstMediaSrc);
						}
					}

					const variantData = {
						variant: {
							id: defaultVariantId,
							price: v.price != null ? String(v.price) : undefined,
							sku: v.sku || undefined,
							inventory_management:
								v.inventoryManagement?.toLowerCase() || 'shopify',
							inventory_policy:
								v.inventoryPolicy?.toLowerCase() || 'deny',
							option1: optionsValues[0] || undefined,
							option2: optionsValues[1] || undefined,
							option3: optionsValues[2] || undefined,
							image_id: imageId,
						},
					};

					const updateVariantUrl = `https://${shopUrl}/admin/api/2024-10/variants/${defaultVariantId}.json`;
					const variantResp = await axios.put(
						updateVariantUrl,
						variantData,
						{
							headers: {
								'X-Shopify-Access-Token':
									process.env.SHOPIFY_ACCESS_TOKEN,
								'Content-Type': 'application/json',
							},
						}
					);

					const variant = variantResp.data.variant;

					console.log('\n=== PRODUCTO CREADO EXITOSAMENTE ===\n');

					return res.json({
						success: true,
						product: {
							id: productId,
							gid: productGid,
							title: input.title,
						},
						variants: [
							{
								id: `gid://shopify/ProductVariant/${variant.id}`,
								numericId: variant.id,
								sku: variant.sku,
								price: variant.price,
								image_id: variant.image_id,
								inventory_item_id: variant.inventory_item_id,
								options: optionsValues,
							},
						],
						summary: {
							totalVariants: 1,
							totalImages: mediaMap.size,
						},
					});
				}
			}
		} catch (err) {
			console.error('Error obteniendo variantes:', err.message);
		}
		// PASO 5: Crear las variantes personalizadas
		if (input.variants.length > 1) {
			console.log('\n[5/5] Creando variantes personalizadas...');
			const createdVariants = [];

			for (let i = 0; i < input.variants.length; i++) {
				const v = input.variants[i];
				const optionsValues = Array.isArray(v.options)
					? v.options
					: [];

				// Buscar el ID de imagen para esta variante
				let imageId = null;
				if (Array.isArray(v.mediaSrc) && v.mediaSrc.length > 0) {
					const firstMediaSrc = v.mediaSrc[0];
					if (mediaMap.has(firstMediaSrc)) {
						imageId = mediaMap.get(firstMediaSrc);
						console.log(
							`  → Variante ${v.sku}: asignando imagen ID ${imageId}`
						);
					}
				}

				const variantData = {
					variant: {
						price: v.price != null ? String(v.price) : undefined,
						sku: v.sku || undefined,
						inventory_management:
							v.inventoryManagement?.toLowerCase() || 'shopify',
						inventory_policy:
							v.inventoryPolicy?.toLowerCase() || 'deny',
						option1: optionsValues[0] || undefined,
						option2: optionsValues[1] || undefined,
						option3: optionsValues[2] || undefined,
						image_id: imageId,
					},
				};

				try {
					const createVariantUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}/variants.json`;
					const variantResp = await axios.post(
						createVariantUrl,
						variantData,
						{
							headers: {
								'X-Shopify-Access-Token':
									process.env.SHOPIFY_ACCESS_TOKEN,
								'Content-Type': 'application/json',
							},
						}
					);

					if (variantResp.data?.variant?.id) {
						const variant = variantResp.data.variant;
						createdVariants.push({
							id: `gid://shopify/ProductVariant/${variant.id}`,
							numericId: variant.id,
							sku: variant.sku,
							price: variant.price,
							image_id: variant.image_id,
							inventory_item_id: variant.inventory_item_id,
							options: optionsValues,
						});

						console.log(
							`✓ Variante ${i + 1}/${input.variants.length}: ${
								variant.sku
							} (ID: ${variant.id})`
						);
					}
				} catch (variantError) {
					console.error(
						`✗ Error creando variante ${v.sku}:`,
						variantError.response?.data || variantError.message
					);
					return res.status(400).json({
						success: false,
						error: `Error creando variante ${v.sku}`,
						details: variantError.response?.data,
					});
				}
			}
		}

		// PASO 6: Eliminar la variante por defecto si se crearon variantes personalizadas
		if (defaultVariantId && createdVariants.length > 0) {
			console.log('\n[6/6] Eliminando variante por defecto...');
			try {
				const deleteUrl = `https://${shopUrl}/admin/api/2024-10/products/${productId}/variants/${defaultVariantId}.json`;
				await axios.delete(deleteUrl, {
					headers: {
						'X-Shopify-Access-Token':
							process.env.SHOPIFY_ACCESS_TOKEN,
					},
				});
				console.log('✓ Variante por defecto eliminada');
			} catch (deleteError) {
				console.warn(
					'⚠ No se pudo eliminar la variante por defecto:',
					deleteError.response?.data || deleteError.message
				);
			}
		}

		console.log('\n=== PRODUCTO CREADO EXITOSAMENTE ===\n');

		return res.json({
			success: true,
			product: {
				id: productId,
				gid: productGid,
				title: input.title,
			},
			variants: createdVariants,
			summary: {
				totalVariants: createdVariants.length,
				totalImages: mediaMap.size,
			},
		});
	} catch (err) {
		console.error('\n=== ERROR EN CREACIÓN DE PRODUCTO ===');
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
	createProductsGraphQL,
	updateVariantPricesGraphQL,
	createProductWithMediaGraphQL,
	deleteProductGraphQL,
	updateVariantMedia,
	updateVariant,
	deleteVariant,
	createVariantGraphQL,
	createProductFullFlow,
};
