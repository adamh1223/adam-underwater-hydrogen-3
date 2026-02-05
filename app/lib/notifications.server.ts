import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';
import {variantQuery} from '~/lib/customerQueries';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {
  createNotificationId,
  getUnreadCount,
  parseNotifications,
  type Notification,
} from '~/lib/notifications';

type NotificationsState = {
  orderStatusSnapshot?: Record<
    string,
    {
      financialStatus?: string | null;
      fulfillmentStatus?: string | null;
    }
  >;
};

const NOTIFICATIONS_METAFIELD_NAMESPACE = 'custom';
const NOTIFICATIONS_METAFIELD_KEY = 'notifications';
const NOTIFICATIONS_STATE_METAFIELD_KEY = 'notifications_state';

const CUSTOMER_NOTIFICATIONS_SYNC_QUERY = `#graphql
  query CustomerNotificationsSync {
    customer {
      id
      emailAddress {
        marketingState
      }
      phoneNumber {
        phoneNumber
        marketingState
      }
      notifications: metafield(namespace: "custom", key: "notifications") {
        value
      }
      notificationsState: metafield(namespace: "custom", key: "notifications_state") {
        value
      }
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          number
          processedAt
          financialStatus
          fulfillments(first: 1) {
            nodes {
              status
            }
          }
          lineItems(first: 20) {
            nodes {
              title
              variantId
            }
          }
        }
      }
    }
  }
` as const;

	const NOTIFICATION_RECOMMENDED_PRODUCTS_QUERY = `#graphql
	  fragment NotificationProduct on Product {
	    id
	    title
	    handle
	    tags
	    featuredImage {
	      url
	      altText
	      width
	      height
	    }
	    images(first: 20) {
	      nodes {
	        url
	        altText
	      }
	    }
	    priceRange {
	      minVariantPrice {
	        amount
	        currencyCode
	      }
	    }
	    selectedOrFirstAvailableVariant {
	      id
	      availableForSale
	      compareAtPrice {
	        amount
	        currencyCode
	      }
	      price {
	        amount
	        currencyCode
	      }
	    }
	  }

  query NotificationRecommendedProducts(
    $first: Int!
    $query: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...NotificationProduct
      }
    }
  }
` as const;

function getAdminConfig(env: Record<string, any>) {
  const adminToken = env.SHOPIFY_ADMIN_TOKEN;
  const storeDomain = env.PUBLIC_STORE_DOMAIN;
  const adminDomainEnv = env.SHOPIFY_ADMIN_DOMAIN;

  if (!adminToken || !storeDomain) return null;

  const sanitizedStoreDomain = storeDomain.replace(/^https?:\/\//, '');
  const adminDomain =
    adminDomainEnv?.replace(/^https?:\/\//, '') ??
    (sanitizedStoreDomain.includes('myshopify.com')
      ? sanitizedStoreDomain
      : null);
  if (!adminDomain) return null;

  return {
    adminToken,
    adminEndpoint: `https://${adminDomain}/admin/api/2025-01/graphql.json`,
  };
}

async function adminGraphql({
  adminEndpoint,
  adminToken,
  query,
  variables,
}: {
  adminEndpoint: string;
  adminToken: string;
  query: string;
  variables?: Record<string, any>;
}) {
  const response = await fetch(adminEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': adminToken,
    },
    body: JSON.stringify({query, variables}),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Admin API error (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text) as any;
  } catch {
    throw new Error('Invalid Admin API response.');
  }
}

function parseNotificationsState(value: unknown): NotificationsState {
  if (typeof value !== 'string' || !value.length) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as NotificationsState;
  } catch {
    return {};
  }
}

function isSubscribedMarketingState(marketingState?: string | null) {
  return marketingState === 'SUBSCRIBED' || marketingState === 'PENDING';
}

function hasNotification(
  notifications: Notification[],
  predicate: (notification: Notification) => boolean,
) {
  return notifications.some(predicate);
}

function sortByCreatedAtDesc(notifications: Notification[]) {
  return [...notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

type RecommendationCategory = 'Prints' | 'Video';

async function resolveOrderRecommendationDetails(
  storefront: any,
  lineItems: Array<{variantId?: unknown; title?: unknown}>,
): Promise<{
  categories: RecommendationCategory[];
  purchasedTitleByCategory: Partial<Record<RecommendationCategory, string>>;
}> {
  const variantIds = lineItems
    .map((lineItem) => lineItem?.variantId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const uniqueVariantIds = Array.from(new Set(variantIds)).slice(0, 20);
  if (!uniqueVariantIds.length) {
    return {categories: [], purchasedTitleByCategory: {}};
  }

  const results = await Promise.all(
    uniqueVariantIds.map((id) =>
      storefront.query(variantQuery, {variables: {id}}).catch(() => null),
    ),
  );

  const categories = new Set<RecommendationCategory>();
  const categoriesByVariantId = new Map<string, RecommendationCategory[]>();

  for (const result of results) {
    const node = result?.node as any;
    const tags = node?.product?.tags;
    if (typeof node?.id !== 'string' || !Array.isArray(tags)) continue;

    const variantCategories: RecommendationCategory[] = [];
    if (tags.includes('Video')) variantCategories.push('Video');
    if (tags.includes('Prints')) variantCategories.push('Prints');
    if (!variantCategories.length) continue;

    categoriesByVariantId.set(node.id, variantCategories);
    variantCategories.forEach((category) => categories.add(category));
  }

  const purchasedTitleByCategory: Partial<
    Record<RecommendationCategory, string>
  > = {};

  for (const lineItem of lineItems) {
    const variantId =
      typeof lineItem?.variantId === 'string' ? lineItem.variantId : null;
    if (!variantId) continue;

    const variantCategories = categoriesByVariantId.get(variantId);
    if (!variantCategories?.length) continue;

    const title = typeof lineItem?.title === 'string' ? lineItem.title.trim() : '';
    if (!title) continue;

    for (const category of variantCategories) {
      if (!purchasedTitleByCategory[category]) {
        purchasedTitleByCategory[category] = title;
      }
    }
  }

  return {categories: Array.from(categories), purchasedTitleByCategory};
}

export async function syncCustomerNotifications(
  context: any,
  {limit}: {limit?: number} = {},
) {
  const loggedOutNotification: Notification = {
    id: 'logged-out-discount',
    type: 'discount',
    title: 'DISCOUNT CODE',
    message:
      'Create an account and sign up for SMS + email marketing to get 10% off.',
    createdAt: new Date(0).toISOString(),
    readAt: null,
    href: '/account/login',
    payload: null,
  };

  const adminConfig = getAdminConfig(context.env);

  let customerResponse: any = null;
  try {
    customerResponse = await context.customerAccount.query(
      CUSTOMER_NOTIFICATIONS_SYNC_QUERY,
    );
  } catch {
    const notifications = [loggedOutNotification];
    return {
      loggedIn: false,
      notifications: limit ? notifications.slice(0, limit) : notifications,
      unreadCount: 1,
    };
  }

  const customer = customerResponse?.data?.customer;
  if (!customer?.id) {
    const notifications = [loggedOutNotification];
    return {
      loggedIn: false,
      notifications: limit ? notifications.slice(0, limit) : notifications,
      unreadCount: 1,
    };
  }

  const customerId = customer.id as string;
  const existingNotifications = parseNotifications(customer.notifications?.value);
  const existingState = parseNotificationsState(
    customer.notificationsState?.value,
  );

  const notifications = [...existingNotifications];
  const nextState: NotificationsState = {
    ...existingState,
    orderStatusSnapshot: {...(existingState.orderStatusSnapshot ?? {})},
  };

  let didMutate = false;

  const emailMarketingState = customer.emailAddress?.marketingState as
    | string
    | null
    | undefined;
  const smsMarketingState = customer.phoneNumber?.marketingState as
    | string
    | null
    | undefined;
  const hasPhoneNumber = Boolean(
    (customer.phoneNumber?.phoneNumber as string | null | undefined)?.trim()
      ?.length,
  );
  const needsDiscountNotification =
    !isSubscribedMarketingState(emailMarketingState) ||
    !hasPhoneNumber ||
    !isSubscribedMarketingState(smsMarketingState);

  if (needsDiscountNotification) {
    if (!hasNotification(notifications, (n) => n.type === 'discount')) {
      notifications.push({
        id: createNotificationId(),
        type: 'discount',
        title: 'DISCOUNT CODE',
        message:
          'Sign up for SMS + email marketing and we’ll send you a 10% off discount.',
        createdAt: new Date().toISOString(),
        readAt: null,
        href: '/account/profile',
        payload: null,
      });
      didMutate = true;
    }
  } else {
    const before = notifications.length;
    const filtered = notifications.filter((n) => n.type !== 'discount');
    if (filtered.length !== before) {
      notifications.length = 0;
      notifications.push(...filtered);
      didMutate = true;
    }
  }

  const deliveredStatuses = new Set(['DELIVERED', 'SUCCESS']);
  const orders = (customer.orders?.nodes ?? []) as Array<any>;
  let didUpdateOrderSnapshot = false;

  for (const order of orders) {
    if (!order?.id) continue;
    const orderId = order.id as string;
    const orderNumber = order.number as number | null | undefined;
    const processedAt = order.processedAt as string | null | undefined;
    const financialStatus = (order.financialStatus as string | null) ?? null;
    const fulfillmentStatus =
      (order.fulfillments?.nodes?.[0]?.status as string | null) ?? null;

    const prevSnapshot = nextState.orderStatusSnapshot?.[orderId];
    const nextSnapshot = {financialStatus, fulfillmentStatus};

    if (
      !prevSnapshot ||
      prevSnapshot.financialStatus !== financialStatus ||
      prevSnapshot.fulfillmentStatus !== fulfillmentStatus
    ) {
      didUpdateOrderSnapshot = true;
    }

    if (
      prevSnapshot &&
      (prevSnapshot.financialStatus !== financialStatus ||
        prevSnapshot.fulfillmentStatus !== fulfillmentStatus)
    ) {
      const orderIdParam = encodeURIComponent(btoa(orderId));
      notifications.push({
        id: createNotificationId(),
        type: 'order_status',
        title: `Order #${orderNumber ?? ''} updated`,
        message: `Your order status has changed. Click to view your order.`,
        createdAt: new Date().toISOString(),
        readAt: null,
        href: `/account/orders/${orderIdParam}`,
        payload: {
          orderId,
          orderNumber,
          processedAt,
          previous: prevSnapshot,
          next: nextSnapshot,
        },
      });
      didMutate = true;
    }

    if (nextState.orderStatusSnapshot) {
      nextState.orderStatusSnapshot[orderId] = nextSnapshot;
    }

    const isDelivered =
      typeof fulfillmentStatus === 'string' &&
      deliveredStatuses.has(fulfillmentStatus);

    if (
      isDelivered &&
      !hasNotification(
        notifications,
        (n) => n.type === 'leave_review' && n.payload?.orderId === orderId,
      )
    ) {
      notifications.push({
        id: createNotificationId(),
        type: 'leave_review',
        title: `Order #${orderNumber ?? ''} delivered`,
        message:
          'Your order was delivered. Please take a moment to leave a review.',
        createdAt: new Date().toISOString(),
        readAt: null,
        href: '/account/reviews',
        payload: {orderId, orderNumber, processedAt},
      });
      didMutate = true;
    }

    if (!isDelivered) continue;

    const {categories, purchasedTitleByCategory} =
      await resolveOrderRecommendationDetails(
        context.storefront,
        (order.lineItems?.nodes ?? []) as Array<{
          variantId?: unknown;
          title?: unknown;
        }>,
      );

    for (const category of categories) {
      const purchasedTitle = purchasedTitleByCategory[category];
      const nextTitle = `Because you bought ${
        purchasedTitle ?? (category === 'Video' ? 'a stock footage clip' : 'a print')
      }`;
      const nextMessage = `Here are more ${category.toLowerCase()} products we think you’d like.`;

      let didUpdateExisting = false;
      for (let index = 0; index < notifications.length; index += 1) {
        const existing = notifications[index];
        if (
          existing.type === 'recommendations' &&
          existing.payload?.orderId === orderId &&
          existing.payload?.category === category
        ) {
          didUpdateExisting = true;
          if (existing.title !== nextTitle || existing.message !== nextMessage) {
            notifications[index] = {
              ...existing,
              title: nextTitle,
              message: nextMessage,
            };
            didMutate = true;
          }
        }
      }

      if (didUpdateExisting) continue;

      notifications.push({
        id: createNotificationId(),
        type: 'recommendations',
        title: nextTitle,
        message: nextMessage,
        createdAt: new Date().toISOString(),
        readAt: null,
        href: `/account/notifications`,
        payload: {orderId, orderNumber, processedAt, category},
      });
      didMutate = true;
    }
  }

  const sortedNotifications = sortByCreatedAtDesc(notifications).slice(0, 50);
  const unreadCount = getUnreadCount(sortedNotifications);

  if (didUpdateOrderSnapshot) {
    didMutate = true;
  }

  if (didMutate && adminConfig) {
    try {
      const mutation = await adminGraphql({
        ...adminConfig,
        query: ADMIN_METAFIELD_SET,
        variables: {
          metafields: [
            {
              ownerId: customerId,
              namespace: NOTIFICATIONS_METAFIELD_NAMESPACE,
              key: NOTIFICATIONS_METAFIELD_KEY,
              type: 'json',
              value: JSON.stringify(sortedNotifications),
            },
            {
              ownerId: customerId,
              namespace: NOTIFICATIONS_METAFIELD_NAMESPACE,
              key: NOTIFICATIONS_STATE_METAFIELD_KEY,
              type: 'json',
              value: JSON.stringify(nextState),
            },
          ],
        },
      });

      const errors =
        mutation?.data?.metafieldsSet?.userErrors ??
        mutation?.errors ??
        [];
      if (Array.isArray(errors) && errors.length) {
        console.error('Unable to persist notifications', errors);
      }
    } catch (error) {
      console.error('Unable to persist notifications', error);
    }
  }

  return {
    loggedIn: true,
    notifications: limit ? sortedNotifications.slice(0, limit) : sortedNotifications,
    unreadCount,
  };
}

export async function markCustomerNotificationRead(
  context: any,
  notificationId: string,
) {
  const adminConfig = getAdminConfig(context.env);
  if (!adminConfig) {
    return {
      ok: false,
      error: 'Missing Admin API configuration for notifications.',
    };
  }

  const customerQuery = `#graphql
    query CustomerNotificationsRead {
      customer {
        id
        notifications: metafield(namespace: "custom", key: "notifications") {
          value
        }
      }
    }
  ` as const;

  const customerResponse = await context.customerAccount.query(customerQuery);
  const customer = customerResponse?.data?.customer;
  const customerId = customer?.id as string | undefined;

  if (!customerId) {
    return {ok: false, error: 'Not authenticated.'};
  }

  const notifications = parseNotifications(customer.notifications?.value);
  const index = notifications.findIndex((n) => n.id === notificationId);
  if (index === -1) {
    return {ok: true, notifications, unreadCount: getUnreadCount(notifications)};
  }

  if (notifications[index].readAt) {
    return {ok: true, notifications, unreadCount: getUnreadCount(notifications)};
  }

  notifications[index] = {
    ...notifications[index],
    readAt: new Date().toISOString(),
  };

  try {
    const mutation = await adminGraphql({
      ...adminConfig,
      query: ADMIN_METAFIELD_SET,
      variables: {
        metafields: [
          {
            ownerId: customerId,
            namespace: NOTIFICATIONS_METAFIELD_NAMESPACE,
            key: NOTIFICATIONS_METAFIELD_KEY,
            type: 'json',
            value: JSON.stringify(notifications),
          },
        ],
      },
    });

    const errors =
      mutation?.data?.metafieldsSet?.userErrors ?? mutation?.errors ?? [];
    if (Array.isArray(errors) && errors.length) {
      console.error('Unable to mark notification read', errors);
    }
  } catch (error) {
    console.error('Unable to mark notification read', error);
  }

  return {
    ok: true,
    notifications,
    unreadCount: getUnreadCount(notifications),
  };
}

export async function getNotificationRecommendedProducts(
  context: any,
  category: 'Prints' | 'Video',
) {
  const query =
    category === 'Video'
      ? 'tag:Video'
      : 'tag:Prints -tag:Video';

  try {
    const response = await context.storefront.query(
      NOTIFICATION_RECOMMENDED_PRODUCTS_QUERY,
      {variables: {first: 6, query}},
    );
    return response?.products?.nodes ?? [];
  } catch (error) {
    console.error('Unable to load recommended products', error);
    return [];
  }
}

export type NotificationOrderLineItem = {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  image: {
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  product: {
    id: string;
    handle: string;
    tags: string[];
  } | null;
};

export type NotificationOrderDetails = {
  orderId: string;
  orderName: string | null;
  lineItems: NotificationOrderLineItem[];
};

export async function getNotificationOrderDetails(
  context: any,
  orderId: string,
): Promise<NotificationOrderDetails | null> {
  if (!orderId) return null;

  try {
    const {data, errors} = await context.customerAccount.query(
      CUSTOMER_ORDER_QUERY,
      {
        variables: {orderId},
      },
    );

    if (errors?.length || !data?.order) return null;
    const order = data.order as any;

    const rawLineItems = (order?.lineItems?.nodes ?? []) as Array<any>;
    const lineItems = rawLineItems.slice(0, 50);
    const variantIds = lineItems
      .map((lineItem) => lineItem?.variantId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const uniqueVariantIds = Array.from(new Set(variantIds)).slice(0, 50);
    const variantResults = await Promise.all(
      uniqueVariantIds.map((id) =>
        context.storefront.query(variantQuery, {variables: {id}}).catch(() => null),
      ),
    );

    const productByVariantId = new Map<
      string,
      {id: string; handle: string; tags: string[]}
    >();

    for (const result of variantResults) {
      const node = result?.node as any;
      const product = node?.product;
      if (!node?.id || !product?.id || !product?.handle) continue;
      productByVariantId.set(node.id as string, {
        id: product.id as string,
        handle: product.handle as string,
        tags: Array.isArray(product.tags) ? (product.tags as string[]) : [],
      });
    }

    const hydratedLineItems: NotificationOrderLineItem[] = lineItems.map(
      (lineItem) => {
        const variantId =
          typeof lineItem?.variantId === 'string' ? (lineItem.variantId as string) : null;
        const product = variantId ? productByVariantId.get(variantId) ?? null : null;

        return {
          id: (lineItem?.id as string) ?? `${variantId ?? ''}-${Math.random()}`,
          title: (lineItem?.title as string) ?? '',
          variantTitle:
            typeof lineItem?.variantTitle === 'string'
              ? (lineItem.variantTitle as string)
              : null,
          quantity: typeof lineItem?.quantity === 'number' ? lineItem.quantity : 1,
          image: lineItem?.image?.url
            ? {
                url: lineItem.image.url as string,
                altText:
                  typeof lineItem.image.altText === 'string'
                    ? (lineItem.image.altText as string)
                    : null,
                width:
                  typeof lineItem.image.width === 'number'
                    ? (lineItem.image.width as number)
                    : null,
                height:
                  typeof lineItem.image.height === 'number'
                    ? (lineItem.image.height as number)
                    : null,
              }
            : null,
          product,
        };
      },
    );

    return {
      orderId: (order?.id as string) ?? orderId,
      orderName: typeof order?.name === 'string' ? (order.name as string) : null,
      lineItems: hydratedLineItems,
    };
  } catch (error) {
    console.error('Unable to load notification order details', error);
    return null;
  }
}
