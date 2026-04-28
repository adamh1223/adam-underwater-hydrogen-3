import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';
import {variantQuery} from '~/lib/customerQueries';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {
  createNotificationId,
  getUnreadCount,
  parseNotifications,
  type Notification,
} from '~/lib/notifications';
import {getR2ObjectKeyFromTagsForVariant} from '~/lib/downloads';
import {applyHighestResolutionVariantToProducts} from '~/lib/resolution';
import {hasVideoTag, isPrintProductFromTags} from '~/lib/productTags';

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

const CUSTOMER_NOTIFICATIONS_SYNC_QUERY = `
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
          totalPrice {
            amount
            currencyCode
          }
          fulfillments(first: 1) {
            nodes {
              status
              trackingInformation {
                company
                number
                url
              }
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
	    options {
	      name
	      optionValues {
	        name
	        firstSelectableVariant {
	          id
	          availableForSale
	          image {
	            url
	            altText
	            width
	            height
	          }
	          price {
	            amount
	            currencyCode
	          }
	          compareAtPrice {
	            amount
	            currencyCode
	          }
	        }
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

function getDisplayFulfillmentStatus(status: string | null): string {
  const s = (status ?? '').trim().toUpperCase();
  if (!s) return 'Preparing Shipment';
  switch (s) {
    case 'SUCCESS':
    case 'DELIVERED':
      return 'Delivered';
    case 'FULFILLED':
      return 'Shipped';
    case 'IN_TRANSIT':
    case 'ON_ITS_WAY':
      return 'In Transit';
    case 'OUT_FOR_DELIVERY':
      return 'Out for Delivery';
    case 'ATTEMPTED_TO_DELIVER':
      return 'Delivery Attempted';
    case 'PARTIALLY_FULFILLED':
      return 'Partially Shipped';
    case 'MULTIPLE_SHIPMENTS':
      return 'Shipped';
    case 'OPEN':
    case 'PENDING':
    case 'UNFULFILLED':
    case 'IN_PROGRESS':
    case 'PREPARING_FOR_SHIPPING':
    case 'CONFIRMED':
      return 'Preparing Shipment';
    case 'READY_FOR_PICKUP':
      return 'Ready for pickup';
    case 'PICKED_UP':
      return 'Picked up in store';
    case 'MIXED_PREPARING_PRINTS':
      return 'Stock Footage Delivered, Preparing Prints';
    case 'MIXED_PRINTS_SHIPPED':
      return 'Stock Footage Delivered, Prints Shipped';
    case 'RETURN_IN_PROGRESS':
    case 'RETURN_REQUESTED':
      return 'Return in Progress';
    case 'RETURNED':
      return 'Returned';
    case 'CANCELLED':
      return 'Cancelled';
    case 'ERROR':
    case 'FAILURE':
    case 'THERE_WAS_A_PROBLEM':
      return 'There Was a Problem';
    default:
      return 'Preparing Shipment';
  }
}

function getDisplayFinancialStatus(status: string | null): string {
  const s = (status ?? '').trim().toUpperCase();
  switch (s) {
    case 'PAID':
      return 'Paid';
    case 'PARTIALLY_REFUNDED':
      return 'Partially Refunded';
    case 'REFUNDED':
      return 'Refunded';
    case 'PENDING':
      return 'Payment Pending';
    case 'VOIDED':
      return 'Voided';
    case 'AUTHORIZED':
      return 'Authorized';
    case 'PARTIALLY_PAID':
      return 'Partially Paid';
    default:
      return s || 'Paid';
  }
}

function getOrderStatusNotificationContent(
  orderNumber: number | null | undefined,
  fulfillmentStatus: string | null,
  isNewOrder: boolean,
  financialStatus?: string | null,
  previousFinancialStatus?: string | null,
): {title: string; message: string} {
  const orderLabel = `Order #${orderNumber ?? ''}`;
  const normalizedStatus = (fulfillmentStatus ?? '').trim().toUpperCase();
  const normalizedFinancial = (financialStatus ?? '').trim().toUpperCase();
  const normalizedPrevFinancial = (previousFinancialStatus ?? '').trim().toUpperCase();

  if (isNewOrder) {
    return {
      title: `${orderLabel} placed`,
      message:
        'We are processing your order. You will receive an email when it ships. Please allow 3-7 business days to ship.',
    };
  }

  // Check if financial status changed to refunded
  const becameRefunded =
    (normalizedFinancial === 'REFUNDED' || normalizedFinancial === 'PARTIALLY_REFUNDED') &&
    normalizedPrevFinancial !== normalizedFinancial;

  if (becameRefunded) {
    const refundLabel = normalizedFinancial === 'PARTIALLY_REFUNDED' ? 'partially refunded' : 'refunded';
    return {
      title: `${orderLabel} ${refundLabel}`,
      message:
        'Your refund has been approved. Please allow 7-10 business days for the refund to appear on your original form of payment.',
    };
  }

  switch (normalizedStatus) {
    case 'FULFILLED':
    case 'MULTIPLE_SHIPMENTS':
      return {
        title: `${orderLabel} shipped`,
        message:
          'Your order has been shipped. Check your email for tracking information.',
      };
    case 'IN_TRANSIT':
    case 'ON_ITS_WAY':
      return {
        title: `${orderLabel} in transit`,
        message: 'Your order is on its way.',
      };
    case 'OUT_FOR_DELIVERY':
      return {
        title: `${orderLabel} out for delivery`,
        message: 'Your order is out for delivery.',
      };
    case 'SUCCESS':
    case 'DELIVERED':
      return {
        title: `${orderLabel} delivered`,
        message: 'Your order was delivered.',
      };
    case 'ATTEMPTED_TO_DELIVER':
      return {
        title: `${orderLabel} delivery attempted`,
        message:
          'A delivery attempt was made for your order. Please check your tracking information.',
      };
    case 'READY_FOR_PICKUP':
      return {
        title: `${orderLabel} ready for pickup`,
        message: 'Your order is ready for pickup.',
      };
    case 'PICKED_UP':
      return {
        title: `${orderLabel} picked up`,
        message: 'Your order has been picked up.',
      };
    case 'RETURN_IN_PROGRESS':
    case 'RETURN_REQUESTED':
      return {
        title: `${orderLabel} return in progress`,
        message: 'Your return request is being processed.',
      };
    case 'RETURNED':
      return {
        title: `${orderLabel} returned`,
        message: 'Your return has been completed.',
      };
    case 'CANCELLED':
      return {
        title: `${orderLabel} cancelled`,
        message: 'Your order has been cancelled.',
      };
    case 'ERROR':
    case 'FAILURE':
    case 'THERE_WAS_A_PROBLEM':
      return {
        title: `${orderLabel} updated`,
        message:
          'There was a problem with your order. Please contact us for assistance.',
      };
    default:
      return {
        title: `${orderLabel} updated`,
        message: `Your order status has been updated to ${getDisplayFulfillmentStatus(fulfillmentStatus)}.`,
      };
  }
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
    if (hasVideoTag(tags)) variantCategories.push('Video');
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

  if (!hasNotification(notifications, (n) => n.type === 'discount')) {
    notifications.push({
      id: createNotificationId(),
      type: 'discount',
      title: 'DISCOUNT CODE',
      message: needsDiscountNotification
        ? 'Sign up for SMS + email marketing and we’ll send you a 10% off discount.'
        : 'Your 10% off discount remains available in your account.',
      createdAt: new Date().toISOString(),
      readAt: null,
      href: '/account/profile',
      payload: null,
    });
    didMutate = true;
  }

  const deliveredStatuses = new Set(['DELIVERED', 'SUCCESS']);
  const paidStatuses = new Set(['PAID', 'PARTIALLY_PAID']);
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

    const totalPriceAmount = order.totalPrice?.amount as string | null | undefined;
    const totalPriceCurrencyCode = order.totalPrice?.currencyCode as string | null | undefined;
    const trackingInfo = order.fulfillments?.nodes?.[0]?.trackingInformation;
    const firstTracking = Array.isArray(trackingInfo) ? trackingInfo[0] : null;
    const trackingNumber = (firstTracking?.number as string | null) ?? null;
    const trackingUrl = (firstTracking?.url as string | null) ?? null;
    const prevSnapshot = nextState.orderStatusSnapshot?.[orderId];
    const nextSnapshot = {financialStatus, fulfillmentStatus};
    const isNewOrder = !prevSnapshot;
    const statusChanged =
      prevSnapshot &&
      (prevSnapshot.financialStatus !== financialStatus ||
        prevSnapshot.fulfillmentStatus !== fulfillmentStatus);

    if (isNewOrder || statusChanged) {
      didUpdateOrderSnapshot = true;
    }

    if (isNewOrder || statusChanged) {
      const orderIdParam = encodeURIComponent(btoa(orderId));
      const {title: statusTitle, message: statusMessage} =
        getOrderStatusNotificationContent(
          orderNumber,
          fulfillmentStatus,
          isNewOrder,
          financialStatus,
          prevSnapshot?.financialStatus ?? null,
        );
      notifications.push({
        id: createNotificationId(),
        type: 'order_status',
        title: statusTitle,
        message: statusMessage,
        createdAt: new Date().toISOString(),
        readAt: null,
        href: `/account/orders/${orderIdParam}`,
        payload: {
          orderId,
          orderNumber,
          processedAt,
          financialStatus,
          fulfillmentStatus,
          displayFulfillmentStatus: getDisplayFulfillmentStatus(fulfillmentStatus),
          totalPriceAmount: totalPriceAmount ?? null,
          totalPriceCurrencyCode: totalPriceCurrencyCode ?? null,
          trackingNumber,
          trackingUrl,
          previous: prevSnapshot ?? null,
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
    const isPaid =
      typeof financialStatus === 'string' && paidStatuses.has(financialStatus);
    const shouldCreatePostPurchaseNotifications = isDelivered || isPaid;

    if (!shouldCreatePostPurchaseNotifications) continue;

    const {categories, purchasedTitleByCategory} =
      await resolveOrderRecommendationDetails(
        context.storefront,
        (order.lineItems?.nodes ?? []) as Array<{
          variantId?: unknown;
          title?: unknown;
        }>,
      );
    const hasPrintsInOrder = categories.includes('Prints');
    const leaveReviewTitle = `Order #${orderNumber ?? ''} delivered`;
    const leaveReviewMessage = hasPrintsInOrder
      ? 'Your order was delivered. Please take a moment to leave a review.'
      : 'Your order was delivered.';

    const leaveReviewIndex = notifications.findIndex(
      (notification) =>
        notification.type === 'leave_review' &&
        notification.payload?.orderId === orderId,
    );

    if (leaveReviewIndex === -1) {
      notifications.push({
        id: createNotificationId(),
        type: 'leave_review',
        title: leaveReviewTitle,
        message: leaveReviewMessage,
        createdAt: new Date().toISOString(),
        readAt: null,
        href: '/account/reviews',
        payload: {orderId, orderNumber, processedAt},
      });
      didMutate = true;
    } else {
      const existing = notifications[leaveReviewIndex];
      if (
        existing.title !== leaveReviewTitle ||
        existing.message !== leaveReviewMessage
      ) {
        notifications[leaveReviewIndex] = {
          ...existing,
          title: leaveReviewTitle,
          message: leaveReviewMessage,
        };
        didMutate = true;
      }
    }

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

  const customerQuery = `
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
  const query = category === 'Video' ? '-tag:Prints' : 'tag:Prints';

  try {
    const response = await context.storefront.query(
      NOTIFICATION_RECOMMENDED_PRODUCTS_QUERY,
      {variables: {first: 30, query}},
    );
    const nodes = Array.isArray(response?.products?.nodes)
      ? response.products.nodes
      : [];
    const filteredNodes = nodes
      .filter((node) => {
        const tags = Array.isArray((node as any)?.tags) ? (node as any).tags : [];
        return category === 'Video'
          ? hasVideoTag(tags)
          : isPrintProductFromTags(tags);
      })
      .slice(0, 6);
    return applyHighestResolutionVariantToProducts(filteredNodes as any[]);
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
  downloadUrl: string | null;
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

    const variantMetadataByVariantId = new Map<
      string,
      {
        product: {
          id: string;
          handle: string;
          tags: string[];
          options: Array<{name?: string; optionValues?: Array<{name?: string}>}>;
        };
        selectedOptions: Array<{name?: string; value?: string}>;
      }
    >();

    for (const result of variantResults) {
      const node = result?.node as any;
      const product = node?.product;
      if (!node?.id || !product?.id || !product?.handle) continue;
      const selectedOptions = Array.isArray(node?.selectedOptions)
        ? (node.selectedOptions as Array<{name?: string; value?: string}>)
        : [];
      variantMetadataByVariantId.set(node.id as string, {
        product: {
          id: product.id as string,
          handle: product.handle as string,
          tags: Array.isArray(product.tags) ? (product.tags as string[]) : [],
          options: Array.isArray(product.options)
            ? (product.options as Array<{
                name?: string;
                optionValues?: Array<{name?: string}>;
              }>)
            : [],
        },
        selectedOptions,
      });
    }

    const resolvedOrderId = (order?.id as string) ?? orderId;
    let encodedOrderId: string | null = null;
    try {
      encodedOrderId = encodeURIComponent(btoa(resolvedOrderId));
    } catch {
      encodedOrderId = null;
    }

    const hydratedLineItems: NotificationOrderLineItem[] = lineItems.map(
      (lineItem) => {
        const variantId =
          typeof lineItem?.variantId === 'string' ? (lineItem.variantId as string) : null;
        const variantMetadata = variantId
          ? variantMetadataByVariantId.get(variantId) ?? null
          : null;
        const product = variantMetadata?.product ?? null;
        const lineItemId =
          typeof lineItem?.id === 'string' ? (lineItem.id as string) : '';

        let downloadUrl: string | null = null;
        if (encodedOrderId && lineItemId && variantMetadata) {
          const objectKey = getR2ObjectKeyFromTagsForVariant({
            tags: variantMetadata.product.tags,
            selectedOptions: variantMetadata.selectedOptions,
            variantTitle: lineItem?.variantTitle,
            productOptions: variantMetadata.product.options,
          });

          if (objectKey) {
            downloadUrl =
              `/account/orders/${encodedOrderId}/download?lineItemId=${encodeURIComponent(lineItemId)}`;
          }
        }

        return {
          id: lineItemId || `${variantId ?? ''}-${Math.random()}`,
          title: (lineItem?.title as string) ?? '',
          variantTitle:
            typeof lineItem?.variantTitle === 'string'
              ? (lineItem.variantTitle as string)
              : null,
          quantity: typeof lineItem?.quantity === 'number' ? lineItem.quantity : 1,
          downloadUrl,
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
