require('dotenv').config();
const { shopifyApi, LogSeverity } = require('@shopify/shopify-api');
const { NodeAdapter } = require('@shopify/shopify-api/adapters/node');

// Choose API version (prefer env, fallback to stable)
const ADMIN_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

// Dynamically import restResources based on selected version (optional)
// Some @shopify/shopify-api versions may not ship REST resources for newer API versions
let restResources = null;
try {
  restResources = require(`@shopify/shopify-api/rest/admin/${ADMIN_API_VERSION}`).restResources;
} catch (error) {
  console.warn(`[Shopify Config] Could not load REST resources for API version ${ADMIN_API_VERSION}. Ensure this version is supported by the library. Proceeding without REST resources.`);
  restResources = null; 
}

const baseConfig = {
  adapter: NodeAdapter,
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: [
    'read_products',
    'write_products',
    'read_orders',
    'write_orders',
    'read_customers',
    'write_customers',
    'read_inventory',
    'write_inventory'
  ],
  hostName: process.env.SHOPIFY_SHOP_URL,
  apiVersion: ADMIN_API_VERSION,
  isEmbeddedApp: false,
  logger: { level: LogSeverity.Info }, // Set back to Info or adjust as needed
  adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN, // Required for admin client
  userAgentPrefix: "joy-api-shopify"
};

// Only attach restResources if available
const shopify = shopifyApi(restResources ? { ...baseConfig, restResources } : baseConfig);

// Create a session for API clients
const session = {
  shop: process.env.SHOPIFY_SHOP_URL.replace(/^(https?:\/\/)/, ''),
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
};

// REST client (only if resources are available)
const client = restResources ? new shopify.clients.Rest({ session }) : null;

// GraphQL client
const graphqlClient = new shopify.clients.Graphql({ session });

module.exports = { client, graphqlClient, shopify }; 