import type {CustomerAccount} from '@shopify/hydrogen';
import {adminGraphql} from '~/lib/shopify-admin.server';

export const WELCOME15_DISCOUNT_CODE = 'WELCOME15';
export const WELCOME15_USES_REMAINING_METAFIELD_NAMESPACE = 'custom';
export const WELCOME15_USES_REMAINING_METAFIELD_KEY =
  'welcome15_uses_remaining';

const CUSTOMER_DISCOUNT_USAGE_QUERY = `#graphql
  query CustomerDiscountUsage($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          discountApplications(first: 50) {
            nodes {
              __typename
              ... on DiscountCodeApplication {
                code
              }
            }
          }
        }
      }
    }
  }
`;

const ADMIN_CUSTOMER_DISCOUNT_USAGE_QUERY = `#graphql
  query AdminCustomerDiscountUsageByOrderSearch($first: Int!, $query: String!) {
    orders(first: $first, query: $query) {
      nodes {
        id
      }
    }
  }
`;

const ADMIN_CUSTOMER_EMAIL_DISCOUNT_USAGE_QUERY = `#graphql
  query AdminCustomerEmailDiscountUsageByOrderSearch(
    $first: Int!
    $query: String!
  ) {
    orders(first: $first, query: $query) {
      nodes {
        id
      }
    }
  }
`;

const SET_CUSTOMER_DISCOUNT_USES_REMAINING_METAFIELD_MUTATION = `#graphql
  mutation SetCustomerDiscountUsesRemainingMetafield(
    $metafields: [MetafieldsSetInput!]!
  ) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }
`;

type DiscountCodeApplicationNode = {
  __typename?: string;
  code?: string | null;
};

type CustomerDiscountUsageQueryData = {
  customer?: {
    orders?: {
      pageInfo?: {
        hasNextPage?: boolean | null;
        endCursor?: string | null;
      } | null;
      nodes?: Array<{
        discountApplications?: {
          nodes?: DiscountCodeApplicationNode[] | null;
        } | null;
      } | null> | null;
    } | null;
  } | null;
};

type AdminCustomerDiscountUsageQueryData = {
  orders?: {
    nodes?: Array<{
      id?: string | null;
    } | null> | null;
  } | null;
};

type GetCustomerDiscountUsageOptions = {
  customerAccount: Pick<CustomerAccount, 'query'>;
  code: string;
  pageSize?: number;
  maxPages?: number;
};

type GetAdminCustomerDiscountUsageOptions = {
  env: Env;
  customerId: string;
  code: string;
};

type GetAdminCustomerEmailDiscountUsageOptions = {
  env: Env;
  customerEmail: string;
  code: string;
};

type SetCustomerDiscountUsesRemainingOptions = {
  env: Env;
  customerId: string;
  usesRemaining: 0 | 1;
};

export type CustomerDiscountUsage = {
  used: boolean;
  usesRemaining: 0 | 1;
};

type CustomerDiscountOrdersConnection = NonNullable<
  NonNullable<CustomerDiscountUsageQueryData['customer']>['orders']
>;

function resolveUsageResult(used: boolean): CustomerDiscountUsage {
  return {
    used,
    usesRemaining: used ? 0 : 1,
  };
}

export async function getCustomerDiscountUsage({
  customerAccount,
  code,
  pageSize = 20,
  maxPages = 12,
}: GetCustomerDiscountUsageOptions): Promise<CustomerDiscountUsage | null> {
  const targetCode = code.trim().toLowerCase();
  if (!targetCode) {
    return resolveUsageResult(false);
  }

  let used = false;
  let cursor: string | null = null;

  // Safety cap to avoid runaway pagination.
  for (let page = 0; page < maxPages; page += 1) {
    const response: {data?: CustomerDiscountUsageQueryData} | null =
      await customerAccount
        .query<CustomerDiscountUsageQueryData>(CUSTOMER_DISCOUNT_USAGE_QUERY, {
          variables: {
            first: pageSize,
            after: cursor,
          },
        })
        .catch(() => null);

    const ordersConnection = response?.data?.customer
      ?.orders as CustomerDiscountOrdersConnection | null | undefined;

    if (!ordersConnection) {
      return null;
    }

    const orderNodes = Array.isArray(ordersConnection.nodes)
      ? ordersConnection.nodes
      : [];

    for (const orderNode of orderNodes) {
      const discountApplications = Array.isArray(
        orderNode?.discountApplications?.nodes,
      )
        ? orderNode.discountApplications.nodes
        : [];

      const hasMatchingCode = discountApplications.some(
        (application: DiscountCodeApplicationNode) => {
          if (application.__typename !== 'DiscountCodeApplication') {
            return false;
          }

          const discountCodeValue =
            typeof application.code === 'string'
              ? application.code.trim().toLowerCase()
              : '';

          return discountCodeValue === targetCode;
        },
      );

      if (hasMatchingCode) {
        used = true;
        break;
      }
    }

    if (used) break;

    const hasNextPage = Boolean(ordersConnection.pageInfo?.hasNextPage);
    const endCursor: string | null =
      typeof ordersConnection.pageInfo?.endCursor === 'string'
        ? ordersConnection.pageInfo.endCursor
        : null;

    if (!hasNextPage || !endCursor) {
      break;
    }

    cursor = endCursor;
  }

  return resolveUsageResult(used);
}

export async function getAdminCustomerDiscountUsage({
  env,
  customerId,
  code,
}: GetAdminCustomerDiscountUsageOptions): Promise<CustomerDiscountUsage | null> {
  const ownerId = customerId.trim();
  const numericCustomerId = ownerId.replace(/\D/g, '');
  const targetCode = code.trim().toUpperCase();

  if (!ownerId || !numericCustomerId) {
    return null;
  }

  if (!targetCode) {
    return resolveUsageResult(false);
  }

  const searchQuery = `discount_code:${targetCode} customer_id:${numericCustomerId}`;

  const response: {data?: AdminCustomerDiscountUsageQueryData} | null =
    await adminGraphql<{
      data?: AdminCustomerDiscountUsageQueryData;
    }>({
      env,
      query: ADMIN_CUSTOMER_DISCOUNT_USAGE_QUERY,
      variables: {
        first: 1,
        query: searchQuery,
      },
    }).catch(() => null);

  const nodes = Array.isArray(response?.data?.orders?.nodes)
    ? response.data.orders.nodes
    : [];

  return resolveUsageResult(nodes.length > 0);
}

export async function getAdminCustomerEmailDiscountUsage({
  env,
  customerEmail,
  code,
}: GetAdminCustomerEmailDiscountUsageOptions): Promise<CustomerDiscountUsage | null> {
  const normalizedEmail = customerEmail.trim().toLowerCase();
  const targetCode = code.trim().toUpperCase();

  if (!normalizedEmail) {
    return null;
  }

  if (!targetCode) {
    return resolveUsageResult(false);
  }

  const searchQuery = `discount_code:${targetCode} customer_email:${normalizedEmail}`;

  const response: {data?: AdminCustomerDiscountUsageQueryData} | null =
    await adminGraphql<{
      data?: AdminCustomerDiscountUsageQueryData;
    }>({
      env,
      query: ADMIN_CUSTOMER_EMAIL_DISCOUNT_USAGE_QUERY,
      variables: {
        first: 1,
        query: searchQuery,
      },
    }).catch(() => null);

  const nodes = Array.isArray(response?.data?.orders?.nodes)
    ? response.data.orders.nodes
    : [];

  return resolveUsageResult(nodes.length > 0);
}

export async function setCustomerWelcome15UsesRemainingMetafield({
  env,
  customerId,
  usesRemaining,
}: SetCustomerDiscountUsesRemainingOptions): Promise<void> {
  const ownerId = customerId.trim();
  if (!ownerId) return;

  const mutation = await adminGraphql<{
    data?: {
      metafieldsSet?: {
        userErrors?: Array<{field?: string[] | null; message?: string | null}>;
      } | null;
    };
  }>({
    env,
    query: SET_CUSTOMER_DISCOUNT_USES_REMAINING_METAFIELD_MUTATION,
    variables: {
      metafields: [
        {
          ownerId,
          namespace: WELCOME15_USES_REMAINING_METAFIELD_NAMESPACE,
          key: WELCOME15_USES_REMAINING_METAFIELD_KEY,
          type: 'number_integer',
          value: String(usesRemaining),
        },
      ],
    },
  }).catch(() => null);

  const userErrors = mutation?.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length) {
    console.error('Failed to set WELCOME15 uses remaining metafield', {
      customerId: ownerId,
      userErrors,
    });
  }
}
