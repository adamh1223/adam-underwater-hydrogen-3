import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

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

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const rawCode = url.searchParams.get('code');
  const code = rawCode?.trim();

  if (!code) {
    return json({error: 'Missing code'}, {status: 400});
  }

  try {
    await context.customerAccount.handleAuthStatus();
    const loggedIn = await context.customerAccount.isLoggedIn();
    if (!loggedIn) {
      return json({error: 'Unauthorized'}, {status: 401});
    }
  } catch {
    return json({error: 'Unauthorized'}, {status: 401});
  }

  const targetCode = code.toLowerCase();
  let used = false;
  let cursor: string | null = null;

  // Safety cap to avoid runaway pagination.
  for (let page = 0; page < 12; page++) {
    const response = await context.customerAccount
      .query(CUSTOMER_DISCOUNT_USAGE_QUERY, {
        variables: {
          first: 20,
          after: cursor,
        },
      })
      .catch(() => null);

    const ordersConnection = response?.data?.customer?.orders;
    const orderNodes = Array.isArray(ordersConnection?.nodes)
      ? ordersConnection.nodes
      : [];

    for (const orderNode of orderNodes) {
      const discountApplications = Array.isArray(
        orderNode?.discountApplications?.nodes,
      )
        ? orderNode.discountApplications.nodes
        : [];

      const hasMatchingCode = discountApplications.some((application: any) => {
        if (application?.__typename !== 'DiscountCodeApplication') {
          return false;
        }
        const discountCodeValue =
          typeof application?.code === 'string'
            ? application.code.trim().toLowerCase()
            : '';
        return discountCodeValue === targetCode;
      });

      if (hasMatchingCode) {
        used = true;
        break;
      }
    }

    if (used) break;

    const hasNextPage = Boolean(ordersConnection?.pageInfo?.hasNextPage);
    const endCursor =
      typeof ordersConnection?.pageInfo?.endCursor === 'string'
        ? ordersConnection.pageInfo.endCursor
        : null;
    if (!hasNextPage || !endCursor) break;
    cursor = endCursor;
  }

  return json({
    used,
    usesRemaining: used ? 0 : 1,
  });
}

export async function action() {
  return new Response(null, {status: 405});
}
