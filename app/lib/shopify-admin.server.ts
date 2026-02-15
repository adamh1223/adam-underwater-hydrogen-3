type ShopifyAdminConfig = {
  adminEndpoint: string;
  adminToken: string;
};

export function getShopifyAdminConfig(env: Env): ShopifyAdminConfig {
  const adminToken = env.SHOPIFY_ADMIN_TOKEN?.trim();
  const storeDomain = env.PUBLIC_STORE_DOMAIN?.trim();
  const adminDomainEnv = env.SHOPIFY_ADMIN_DOMAIN?.trim();

  if (!adminToken || !storeDomain) {
    throw new Error(
      'Missing Admin API configuration. Set SHOPIFY_ADMIN_TOKEN and PUBLIC_STORE_DOMAIN.',
    );
  }

  const sanitizedStoreDomain = storeDomain.replace(/^https?:\/\//, '');
  const adminDomain =
    adminDomainEnv?.replace(/^https?:\/\//, '') ??
    (sanitizedStoreDomain.includes('myshopify.com')
      ? sanitizedStoreDomain
      : null);

  if (!adminDomain) {
    throw new Error(
      'Missing Shopify Admin domain. Set SHOPIFY_ADMIN_DOMAIN for custom storefront domains.',
    );
  }

  return {
    adminEndpoint: `https://${adminDomain}/admin/api/2025-01/graphql.json`,
    adminToken,
  };
}

export async function adminGraphql<T>({
  env,
  query,
  variables,
}: {
  env: Env;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const {adminEndpoint, adminToken} = getShopifyAdminConfig(env);
  const response = await fetch(adminEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': adminToken,
    },
    body: JSON.stringify({query, variables}),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify Admin API error (${response.status}): ${bodyText}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error('Shopify Admin API returned invalid JSON.');
  }

  const graphqlErrors = parsed?.errors;
  if (Array.isArray(graphqlErrors) && graphqlErrors.length) {
    throw new Error(`Shopify Admin API GraphQL errors: ${JSON.stringify(graphqlErrors)}`);
  }

  return parsed as T;
}
