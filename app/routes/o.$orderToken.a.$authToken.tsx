import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {adminGraphql, getShopifyAdminConfig} from '~/lib/shopify-admin.server';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';
import {Card, CardContent} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {useCallback, useEffect, useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import Sectiontitle from '~/components/global/Sectiontitle';
import {getR2ObjectKeyFromTagsForVariant} from '~/lib/downloads';
import {ProductCarousel} from '~/components/products/productCarousel';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import ReviewForm from '~/components/form/ReviewForm';
import {
  parseReviewMediaDiscountReward,
  REVIEW_MEDIA_DISCOUNT_CODE,
  REVIEW_MEDIA_DISCOUNT_KEY,
  REVIEW_MEDIA_DISCOUNT_NAMESPACE,
  type ReviewMediaDiscountReward,
} from '~/lib/reviewMediaDiscountReward';

const PICKUP_ADDRESS_TEXT = '1080 8th Ave, San Diego, CA 92101';
const PICKUP_ADDRESS_APPLE_MAPS_URL = `https://maps.apple.com/?q=${encodeURIComponent(
  PICKUP_ADDRESS_TEXT,
)}`;

/** Resolved promise indicating the user is NOT logged in (for component props). */
const TOKEN_LOGGED_IN_PROMISE = Promise.resolve(false);

type LineItemSelectedOption = {name: string; value: string};

const ORDER_LINE_ITEM_VARIANT_DETAILS_QUERY = `#graphql
  query OrderLineItemVariantDetails($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        selectedOptions {
          name
          value
        }
        product {
          id
          title
          handle
          tags
          descriptionHtml
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
              width
              height
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
      }
    }
  }
` as const;

const ADMIN_ORDER_BY_ID_QUERY = `#graphql
  query AdminOrderById($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      subtotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      totalTaxSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      totalDiscountsSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      shippingLine {
        title
        code
        source
        shippingRateHandle
      }
      shippingAddress {
        name
        address1
        address2
        city
        provinceCode
        zip
        country
      }
      lineItems(first: 50) {
        nodes {
          id
          title
          quantity
          variantTitle
          originalTotalSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountedTotalSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          image {
            url
            altText
            width
            height
          }
          variant {
            id
            title
            product {
              id
              title
              handle
              tags
            }
          }
        }
      }
      events(first: 15, reverse: true) {
        nodes {
          message
        }
      }
    }
  }
` as const;

const CUSTOMER_REWARD_AND_USAGE_QUERY = `#graphql
  query CustomerRewardAndUsage($customerId: ID!) {
    customer(id: $customerId) {
      metafield(
        namespace: "${REVIEW_MEDIA_DISCOUNT_NAMESPACE}"
        key: "${REVIEW_MEDIA_DISCOUNT_KEY}"
      ) {
        value
      }
      orders(first: 50, reverse: true) {
        nodes {
          discountCodes
        }
      }
    }
  }
` as const;

const PRODUCT_REVIEWS_METAFIELD_QUERY = `#graphql
  query ProductReviewsMetafield($id: ID!) {
    product(id: $id) {
      metafield(namespace: "custom", key: "reviews") {
        value
      }
    }
  }
` as const;

type OrderTokenLookupResult = {
  orderGid: string;
  customerId: string | null;
  customerName: string | null;
};

/**
 * Look up a Shopify order by its token using the REST Admin API.
 * The GraphQL Admin API does not support filtering orders by token,
 * so we use REST to find the order ID, then fetch full details via GraphQL.
 *
 * Also extracts customer data from the REST response — the REST API embeds
 * customer info in the order object without requiring separate `read_customers`
 * scope, unlike the GraphQL Admin API which requires Customer object access.
 */
async function findOrderIdByToken(
  env: Env,
  orderToken: string,
): Promise<OrderTokenLookupResult | null> {
  const {adminEndpoint, adminToken} = getShopifyAdminConfig(env);
  // Derive the REST base URL from the GraphQL endpoint
  const restBase = adminEndpoint.replace('/graphql.json', '');

  const response = await fetch(
    `${restBase}/orders.json?status=any&fields=id,token,customer&limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Shopify Admin REST API error (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    orders?: Array<{
      id: number;
      token: string;
      customer?: {
        id?: number;
        admin_graphql_api_id?: string;
        first_name?: string;
        last_name?: string;
      } | null;
    }>;
  };

  const match = data.orders?.find((o) => o.token === orderToken);
  if (!match) return null;

  const orderGid = `gid://shopify/Order/${match.id}`;

  // Extract customer GID from the REST response
  const customerId = match.customer?.admin_graphql_api_id ?? null;

  // Build customer display name from first/last name
  const firstName = match.customer?.first_name?.trim() ?? '';
  const lastName = match.customer?.last_name?.trim() ?? '';
  const customerName = [firstName, lastName].filter(Boolean).join(' ') || null;

  return {orderGid, customerId, customerName};
}

type AdminLineItem = {
  id: string;
  title: string;
  quantity: number;
  variantTitle: string | null;
  originalTotalSet: {shopMoney: {amount: string; currencyCode: string}};
  discountedTotalSet: {shopMoney: {amount: string; currencyCode: string}};
  image: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
  variant: {
    id: string;
    title: string | null;
    product: {
      id: string;
      title: string;
      handle: string;
      tags: string[];
    } | null;
  } | null;
};

type AdminOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: {shopMoney: {amount: string; currencyCode: string}};
  subtotalPriceSet: {shopMoney: {amount: string; currencyCode: string}};
  totalTaxSet: {shopMoney: {amount: string; currencyCode: string}};
  totalDiscountsSet: {shopMoney: {amount: string; currencyCode: string}};
  shippingLine: {
    title?: string | null;
    code?: string | null;
    source?: string | null;
    shippingRateHandle?: string | null;
  } | null;
  shippingAddress: {
    name?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    provinceCode?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  lineItems: {
    nodes: AdminLineItem[];
  };
  events: {
    nodes: Array<{message: string | null}>;
  };
};

function isPickupOrderPurchaseMethod(
  shippingLine?: AdminOrderNode['shippingLine'],
  hasAnyEProducts?: boolean,
): boolean {
  // POS in-person orders have no shipping line — if the order also has no
  // e-products, assume it was prints sold in person via pickup.
  if (!shippingLine) {
    return !hasAnyEProducts;
  }

  const title = shippingLine.title?.trim() ?? '';
  const code = shippingLine.code?.trim() ?? '';
  const source = shippingLine.source?.trim().toLowerCase() ?? '';
  const handle = shippingLine.shippingRateHandle?.trim().toLowerCase() ?? '';

  const titleLooksLikeAddress =
    /\d/.test(title) &&
    /\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place)\b/i.test(
      title,
    );

  return (
    source === 'shopify' &&
    title.length > 0 &&
    (code === title || titleLooksLikeAddress || handle.includes('pickup'))
  );
}

function getPickupStatusFromOrderEvents(
  eventMessages: Array<string | null | undefined>,
): 'READY_FOR_PICKUP' | 'PICKED_UP' | null {
  for (const message of eventMessages) {
    const normalizedMessage = message?.toLowerCase().trim() ?? '';
    if (!normalizedMessage) continue;

    if (
      normalizedMessage.includes('marked as picked up') ||
      normalizedMessage.includes('mark as picked up') ||
      (normalizedMessage.includes('picked up') &&
        (normalizedMessage.includes('order') ||
          normalizedMessage.includes('pickup')))
    ) {
      return 'PICKED_UP';
    }

    if (normalizedMessage.includes('ready for pickup')) {
      return 'READY_FOR_PICKUP';
    }
  }

  return null;
}

function getDisplayFulfillmentStatus(
  fulfillmentStatus?: string | null,
): string {
  const normalizedStatus = (fulfillmentStatus ?? '').trim().toUpperCase();
  if (!normalizedStatus) return 'Preparing Shipment';

  switch (normalizedStatus) {
    // Carrier confirmed delivery
    case 'SUCCESS':
    case 'DELIVERED':
      return 'Delivered';
    // Merchant marked as fulfilled (tracking number provided)
    case 'FULFILLED':
      return 'Shipped';
    // Carrier-accurate statuses
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
    // Pre-fulfillment statuses
    case 'OPEN':
    case 'PENDING':
    case 'UNFULFILLED':
    case 'IN_PROGRESS':
    case 'PREPARING_FOR_SHIPPING':
    case 'CONFIRMED':
      return 'Preparing Shipment';
    // Pickup statuses
    case 'READY_FOR_PICKUP':
      return 'Ready for pickup';
    case 'PICKED_UP':
      return 'Picked up in store';
    // Mixed order synthetic statuses
    case 'MIXED_PREPARING_PRINTS':
      return 'Stock Footage Delivered, Preparing Prints';
    case 'MIXED_PRINTS_SHIPPED':
      return 'Stock Footage Delivered, Prints Shipped';
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

/** Returns true when the order has been fulfilled (shipped) or beyond. */
function isFulfilledOrBeyond(status?: string | null): boolean {
  const s = (status ?? '').trim().toUpperCase();
  return (
    s === 'FULFILLED' ||
    s === 'SUCCESS' ||
    s === 'DELIVERED' ||
    s === 'IN_TRANSIT' ||
    s === 'ON_ITS_WAY' ||
    s === 'OUT_FOR_DELIVERY' ||
    s === 'ATTEMPTED_TO_DELIVER' ||
    s === 'PARTIALLY_FULFILLED' ||
    s === 'MULTIPLE_SHIPMENTS'
  );
}

/** Returns true when the carrier has confirmed delivery. */
function isDeliveredStatus(status?: string | null): boolean {
  const s = (status ?? '').trim().toUpperCase();
  return s === 'SUCCESS' || s === 'DELIVERED';
}

function formatMoney(amount: string, currencyCode: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(num);
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const orderName = data?.order?.name ?? '';
  return buildIconLinkPreviewMeta(
    orderName
      ? `Adam Underwater | Order ${orderName}`
      : 'Adam Underwater | Order Status',
  );
};

export async function loader({params, context}: LoaderFunctionArgs) {
  const {orderToken} = params;

  if (!orderToken) {
    throw new Response('Order not found', {status: 404});
  }

  // Step 1: Find the order ID by token via REST API
  const orderLookup = await findOrderIdByToken(context.env, orderToken);
  if (!orderLookup) {
    throw new Response('Order not found', {status: 404});
  }

  const {
    orderGid,
    customerId: restCustomerId,
    customerName: restCustomerName,
  } = orderLookup;

  // If the user is already logged in, redirect to the real account order page
  let isLoggedIn = false;
  try {
    isLoggedIn = await context.customerAccount.isLoggedIn();
  } catch {
    // Customer account API may not be available; treat as logged-out.
  }
  if (isLoggedIn) {
    const encodedId = btoa(orderGid);
    return redirect(`/account/orders/${encodedId}`);
  }

  // Step 2: Fetch full order details via GraphQL using the order ID
  const result = await adminGraphql<{
    data?: {
      order?: AdminOrderNode;
    };
  }>({
    env: context.env,
    query: ADMIN_ORDER_BY_ID_QUERY,
    variables: {id: orderGid},
  });

  const order = result?.data?.order;

  if (!order) {
    throw new Response('Order not found', {status: 404});
  }

  const eventMessages = order.events.nodes.map((e) => e.message);
  const pickupStatusFromEvents = getPickupStatusFromOrderEvents(eventMessages);
  const adminFulfillmentStatus =
    pickupStatusFromEvents ?? order.displayFulfillmentStatus;

  // Step 3: Fetch product data from Storefront API for ProductCarousel / EProductsContainer
  const lineItems = order.lineItems.nodes;
  const variantIds = Array.from(
    new Set(
      lineItems
        .map((li) => li.variant?.id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );

  const {storefront} = context;
  const variantResponses = await Promise.all(
    variantIds.map((id) =>
      storefront
        .query(ORDER_LINE_ITEM_VARIANT_DETAILS_QUERY, {
          variables: {id},
        })
        .catch(() => null),
    ),
  );

  const downloadMetadataByVariantId = new Map<
    string,
    {tags: string[]; selectedOptions: Array<{name?: string; value?: string}>}
  >();
  const productByVariantId = new Map<string, any>();
  for (const response of variantResponses) {
    const variant = (response as any)?.node as any;
    if (typeof variant?.id !== 'string') continue;
    const product = variant?.product as any;
    const tags = Array.isArray(variant?.product?.tags)
      ? variant.product.tags
      : [];
    const selectedOptions = Array.isArray(variant?.selectedOptions)
      ? variant.selectedOptions
      : [];
    downloadMetadataByVariantId.set(variant.id, {tags, selectedOptions});
    if (product?.id && product?.handle) {
      productByVariantId.set(variant.id, product);
    }
  }

  // Build lineItemTagsByLineItemId
  const lineItemTagsByLineItemId = lineItems.reduce<Record<string, string[]>>(
    (acc, lineItem) => {
      const lineItemId = lineItem.id;
      const variantId = lineItem.variant?.id;
      if (!lineItemId || !variantId) return acc;

      const variantMetadata = downloadMetadataByVariantId.get(variantId);
      if (!variantMetadata) return acc;

      acc[lineItemId] = variantMetadata.tags;
      return acc;
    },
    {},
  );

  // Build downloadLinksByLineItemId — for the token page we show "Sign in to Download" instead
  const encodedOrderId = btoa(order.id);
  const lineItemHasDownload: Record<string, boolean> = {};
  for (const lineItem of lineItems) {
    const variantId = lineItem.variant?.id;
    if (!variantId) {
      lineItemHasDownload[lineItem.id] = false;
      continue;
    }
    const variantMetadata = downloadMetadataByVariantId.get(variantId);
    if (!variantMetadata) {
      lineItemHasDownload[lineItem.id] = false;
      continue;
    }
    const objectKey = getR2ObjectKeyFromTagsForVariant({
      tags: variantMetadata.tags,
      selectedOptions: variantMetadata.selectedOptions,
      variantTitle: lineItem.variantTitle,
    });
    lineItemHasDownload[lineItem.id] = Boolean(objectKey);
  }

  // Build lineItemProductsByLineItemId
  const lineItemProductsByLineItemId = lineItems.reduce<Record<string, any>>(
    (acc, lineItem) => {
      const lineItemId = lineItem.id;
      const variantId = lineItem.variant?.id;
      if (!lineItemId || !variantId) return acc;

      const product = productByVariantId.get(variantId);
      if (!product) return acc;

      acc[lineItemId] = product;
      return acc;
    },
    {},
  );

  // Build lineItemSelectedOptionsByLineItemId
  const lineItemSelectedOptionsByLineItemId = lineItems.reduce<
    Record<string, LineItemSelectedOption[]>
  >((acc, lineItem) => {
    const lineItemId = lineItem.id;
    const variantId = lineItem.variant?.id;
    if (!lineItemId || !variantId) return acc;

    const variantMetadata = downloadMetadataByVariantId.get(variantId);
    if (!variantMetadata) return acc;

    const selectedOptions = (variantMetadata.selectedOptions ?? [])
      .map((option) => {
        const name = typeof option?.name === 'string' ? option.name.trim() : '';
        const value =
          typeof option?.value === 'string' ? option.value.trim() : '';
        if (!name || !value) return null;
        if (value.toLowerCase() === 'default title') return null;
        return {name, value};
      })
      .filter((option): option is LineItemSelectedOption => option !== null);

    if (!selectedOptions.length) return acc;
    acc[lineItemId] = selectedOptions;
    return acc;
  }, {});

  // --- Customer data for review forms ---
  // Sourced from the REST Admin API (embedded in the order response) so we
  // don't need separate `read_customers` GraphQL scope.
  const orderCustomerId = restCustomerId;
  const orderCustomerName = restCustomerName;

  let reviewMediaDiscountReward: ReviewMediaDiscountReward | null = null;
  let discountUsesRemaining: number | null = null;
  const userReviewExistsByProductId: Record<string, boolean> = {};

  if (orderCustomerId) {
    // Collect print product IDs from Admin order data
    const printProductIds = new Set<string>();
    for (const li of lineItems) {
      const tags = li.variant?.product?.tags ?? [];
      const isPrint = tags.includes('Prints') && !tags.includes('Video');
      if (isPrint && li.variant?.product?.id) {
        printProductIds.add(li.variant.product.id);
      }
    }

    // Fetch customer reward + orders, and product reviews in parallel
    try {
      const [customerDataResult, productReviewsResults] = await Promise.all([
        // Customer reward metafield and order discount codes
        adminGraphql<{
          data?: {
            customer?: {
              metafield?: {value?: string | null} | null;
              orders?: {
                nodes?: Array<{discountCodes?: string[]}>;
              };
            };
          };
        }>({
          env: context.env,
          query: CUSTOMER_REWARD_AND_USAGE_QUERY,
          variables: {customerId: orderCustomerId},
        }).catch(() => null),
        // Product reviews for each print product
        Promise.all(
          Array.from(printProductIds).map(async (productId) => {
            try {
              const res = await adminGraphql<{
                data?: {
                  product?: {
                    metafield?: {value?: string | null} | null;
                  };
                };
              }>({
                env: context.env,
                query: PRODUCT_REVIEWS_METAFIELD_QUERY,
                variables: {id: productId},
              });
              return {
                productId,
                reviewsJson: res?.data?.product?.metafield?.value ?? null,
              };
            } catch {
              return {productId, reviewsJson: null as string | null};
            }
          }),
        ),
      ]);

      // Parse customer reward metafield
      const rewardValue = customerDataResult?.data?.customer?.metafield?.value;
      reviewMediaDiscountReward = parseReviewMediaDiscountReward(rewardValue);

      // Check discount code usage across customer's orders
      if (reviewMediaDiscountReward) {
        const orderNodes =
          customerDataResult?.data?.customer?.orders?.nodes ?? [];
        const targetCode = REVIEW_MEDIA_DISCOUNT_CODE.toLowerCase();
        const hasUsed = orderNodes.some((o) =>
          (o?.discountCodes ?? []).some(
            (code) =>
              typeof code === 'string' && code.toLowerCase() === targetCode,
          ),
        );
        discountUsesRemaining = hasUsed ? 0 : 1;
      }

      // Check if customer has already reviewed each print product
      for (const {productId, reviewsJson} of productReviewsResults) {
        if (!reviewsJson) {
          userReviewExistsByProductId[productId] = false;
          continue;
        }
        try {
          const reviews = JSON.parse(reviewsJson);
          userReviewExistsByProductId[productId] = Array.isArray(reviews)
            ? reviews.some((r: any) => r.customerId === orderCustomerId)
            : false;
        } catch {
          userReviewExistsByProductId[productId] = false;
        }
      }
    } catch {
      // Silently continue — customer data is optional for the page
    }
  }

  // Determine order composition and pickup status
  const hasAnyEProducts = Object.values(lineItemHasDownload).some(Boolean);
  const hasAnyPrints = lineItems.some((li) => {
    const tags = li.variant?.product?.tags ?? [];
    return tags.includes('Prints') && !tags.includes('Video');
  });
  const isEProductOnly = hasAnyEProducts && !hasAnyPrints;
  const isMixedOrder = hasAnyEProducts && hasAnyPrints;

  const isPickupOrder = isPickupOrderPurchaseMethod(
    order.shippingLine,
    hasAnyEProducts,
  );

  // Resolve fulfillment status based on order composition:
  // 1. E-product only → always "Delivered"
  // 2. Mixed (prints + stock footage) → depends on print shipment progress
  // 3. Print-only pickup → "Picked up in store"
  // 4. Otherwise → use Shopify's status
  let resolvedFulfillmentStatus: string | null;
  if (isEProductOnly) {
    resolvedFulfillmentStatus = 'DELIVERED';
  } else if (isMixedOrder) {
    if (isDeliveredStatus(adminFulfillmentStatus)) {
      resolvedFulfillmentStatus = 'DELIVERED';
    } else if (isFulfilledOrBeyond(adminFulfillmentStatus)) {
      resolvedFulfillmentStatus = 'MIXED_PRINTS_SHIPPED';
    } else {
      resolvedFulfillmentStatus = 'MIXED_PREPARING_PRINTS';
    }
  } else if (
    isPickupOrder &&
    !pickupStatusFromEvents &&
    isFulfilledOrBeyond(adminFulfillmentStatus)
  ) {
    resolvedFulfillmentStatus = 'PICKED_UP';
  } else {
    resolvedFulfillmentStatus = adminFulfillmentStatus;
  }
  const displayFulfillmentStatus = getDisplayFulfillmentStatus(
    resolvedFulfillmentStatus,
  );

  const accountOrderPath = `/account/orders/${encodedOrderId}`;

  return {
    order,
    displayFulfillmentStatus,
    isPickupOrder,
    lineItemHasDownload,
    lineItemTagsByLineItemId,
    lineItemProductsByLineItemId,
    lineItemSelectedOptionsByLineItemId,
    accountOrderPath,
    orderCustomerId,
    orderCustomerName,
    reviewMediaDiscountReward,
    discountUsesRemaining,
    userReviewExistsByProductId,
  };
}

export default function OrderTokenStatusPage() {
  const {
    order,
    displayFulfillmentStatus,
    isPickupOrder,
    lineItemHasDownload,
    lineItemTagsByLineItemId,
    lineItemProductsByLineItemId,
    lineItemSelectedOptionsByLineItemId,
    accountOrderPath,
    orderCustomerId,
    orderCustomerName,
    reviewMediaDiscountReward,
    discountUsesRemaining,
    userReviewExistsByProductId,
  } = useLoaderData<typeof loader>();

  const [currentReviewReward, setCurrentReviewReward] =
    useState<ReviewMediaDiscountReward | null>(
      (reviewMediaDiscountReward as ReviewMediaDiscountReward | null) ?? null,
    );

  const signInUrl = `/account/login?redirectTo=${encodeURIComponent(accountOrderPath)}`;

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lineItems = order.lineItems.nodes;

  const subtotal = formatMoney(
    order.subtotalPriceSet.shopMoney.amount,
    order.subtotalPriceSet.shopMoney.currencyCode,
  );
  const tax = formatMoney(
    order.totalTaxSet.shopMoney.amount,
    order.totalTaxSet.shopMoney.currencyCode,
  );
  const total = formatMoney(
    order.totalPriceSet.shopMoney.amount,
    order.totalPriceSet.shopMoney.currencyCode,
  );
  const discountAmount = parseFloat(order.totalDiscountsSet.shopMoney.amount);
  const discount =
    discountAmount > 0
      ? formatMoney(
          order.totalDiscountsSet.shopMoney.amount,
          order.totalDiscountsSet.shopMoney.currencyCode,
        )
      : null;

  return (
    <>
      <div>
        <div className="mx-3 mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
          <Button asChild variant="secondary" className="self-center gap-2">
            <Link to={signInUrl}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back to All Orders</span>
            </Link>
          </Button>
          <div className="min-w-0 self-center">
            <p>
              <strong>Order {order.name}</strong>
            </p>
            <p>Placed on {new Date(order.createdAt).toDateString()}</p>
          </div>
        </div>
      </div>
      <div>
        <div className="account-order">
          <CardContent>
            <div>
              {windowWidth && windowWidth >= 605 && (
                <>
                  <div className="upper-part-large grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div>
                      {lineItems.length <= 1 ? (
                        <Card className="p-3">
                          <div>
                            {lineItems.map((lineItem, index) => (
                              <TokenOrderLineRow
                                key={lineItem.id ?? index}
                                lineItem={lineItem}
                                hasDownload={
                                  lineItemHasDownload[lineItem.id] ?? false
                                }
                                signInUrl={signInUrl}
                                lineItemTagsByLineItemId={
                                  lineItemTagsByLineItemId
                                }
                                lineItemProductsByLineItemId={
                                  lineItemProductsByLineItemId
                                }
                                lineItemSelectedOptionsByLineItemId={
                                  lineItemSelectedOptionsByLineItemId
                                }
                                orderCustomerId={orderCustomerId}
                                orderCustomerName={orderCustomerName}
                                currentReviewReward={currentReviewReward}
                                discountUsesRemaining={
                                  discountUsesRemaining as number | null
                                }
                                userReviewExistsByProductId={
                                  userReviewExistsByProductId as Record<
                                    string,
                                    boolean
                                  >
                                }
                                onReviewRewardChange={setCurrentReviewReward}
                              />
                            ))}
                          </div>
                        </Card>
                      ) : (
                        <div className="space-y-5">
                          {lineItems.map((lineItem, index) => (
                            <Card key={lineItem.id ?? index} className="p-3">
                              <TokenOrderLineRow
                                lineItem={lineItem}
                                hasDownload={
                                  lineItemHasDownload[lineItem.id] ?? false
                                }
                                signInUrl={signInUrl}
                                lineItemTagsByLineItemId={
                                  lineItemTagsByLineItemId
                                }
                                lineItemProductsByLineItemId={
                                  lineItemProductsByLineItemId
                                }
                                lineItemSelectedOptionsByLineItemId={
                                  lineItemSelectedOptionsByLineItemId
                                }
                                orderCustomerId={orderCustomerId}
                                orderCustomerName={orderCustomerName}
                                currentReviewReward={currentReviewReward}
                                discountUsesRemaining={
                                  discountUsesRemaining as number | null
                                }
                                userReviewExistsByProductId={
                                  userReviewExistsByProductId as Record<
                                    string,
                                    boolean
                                  >
                                }
                                onReviewRewardChange={setCurrentReviewReward}
                              />
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="lower-part">
                      <Card className="p-3">
                        <div className="grid grid-cols-2 gap-6 items-start">
                          <div className="min-w-0">
                            <h3 className="pb-3">
                              <strong>
                                {isPickupOrder
                                  ? 'Pickup Address:'
                                  : 'Shipping Address:'}
                              </strong>
                            </h3>
                            {isPickupOrder ? (
                              <a
                                href={PICKUP_ADDRESS_APPLE_MAPS_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary font-medium hover:underline underline-offset-4"
                              >
                                {PICKUP_ADDRESS_TEXT}
                              </a>
                            ) : order.shippingAddress ? (
                              <address>
                                {order.shippingAddress.name && (
                                  <p>{order.shippingAddress.name}</p>
                                )}
                                {order.shippingAddress.address1 && (
                                  <p>{order.shippingAddress.address1}</p>
                                )}
                                {order.shippingAddress.address2 && (
                                  <p>{order.shippingAddress.address2}</p>
                                )}
                                <p>
                                  {[
                                    order.shippingAddress.city,
                                    order.shippingAddress.provinceCode,
                                    order.shippingAddress.zip,
                                  ]
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              </address>
                            ) : (
                              <p>N/A</p>
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <h3 className="pb-3">
                              <strong>Status:</strong>
                            </h3>
                            <p className="cart-combined-savings-glow">
                              {displayFulfillmentStatus}
                            </p>
                          </div>
                        </div>
                      </Card>
                      <div className="pt-3 totals flex justify-end items-end">
                        <Card className="grid grid-cols-1 w-full h-[60%] w-[50%] pe-6">
                          {discount && (
                            <div className="tr flex justify-between">
                              <div className="flex justify-center items-center">
                                <div className="th">
                                  <p>Discounts</p>
                                </div>
                              </div>
                              <div className="flex justify-center items-center">
                                <div className="td">
                                  <span>-{discount}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="tr flex justify-between">
                            <div className="flex justify-center items-center">
                              <div className="th">
                                <p>Subtotal</p>
                              </div>
                            </div>
                            <div className="flex justify-center items-center">
                              <div className="td">{subtotal}</div>
                            </div>
                          </div>
                          <div className="tr flex justify-between">
                            <div className="flex justify-center items-center">
                              <div className="th">Tax</div>
                            </div>
                            <div className="flex justify-center items-center">
                              <div className="td">{tax}</div>
                            </div>
                          </div>
                          <div className="tr flex justify-between">
                            <div className="flex justify-center items-center">
                              <div className="th">Total</div>
                            </div>
                            <div className="flex justify-center items-center">
                              <div className="td">{total}</div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {windowWidth && windowWidth <= 604 && (
                <>
                  <div className="upper-part-small grid grid-cols-1 flex justify-start">
                    <div className="table">
                      <div className="tbody">
                        {lineItems.map((lineItem, index) => (
                          <Card key={lineItem.id ?? index} className="p-3 mb-3">
                            <TokenOrderLineRow
                              lineItem={lineItem}
                              hasDownload={
                                lineItemHasDownload[lineItem.id] ?? false
                              }
                              signInUrl={signInUrl}
                              lineItemTagsByLineItemId={
                                lineItemTagsByLineItemId
                              }
                              lineItemProductsByLineItemId={
                                lineItemProductsByLineItemId
                              }
                              lineItemSelectedOptionsByLineItemId={
                                lineItemSelectedOptionsByLineItemId
                              }
                              orderCustomerId={orderCustomerId}
                              orderCustomerName={orderCustomerName}
                              currentReviewReward={currentReviewReward}
                              discountUsesRemaining={
                                discountUsesRemaining as number | null
                              }
                              userReviewExistsByProductId={
                                userReviewExistsByProductId as Record<
                                  string,
                                  boolean
                                >
                              }
                              onReviewRewardChange={setCurrentReviewReward}
                            />
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lower-part">
                    <Card className="p-3">
                      <div className="grid grid-cols-2 gap-6 items-start">
                        <div className="min-w-0">
                          <h3 className="pb-3">
                            {isPickupOrder
                              ? 'Pickup Address:'
                              : 'Shipping Address:'}
                          </h3>
                          {isPickupOrder ? (
                            <a
                              href={PICKUP_ADDRESS_APPLE_MAPS_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline underline-offset-4"
                            >
                              {PICKUP_ADDRESS_TEXT}
                            </a>
                          ) : order.shippingAddress ? (
                            <address>
                              {order.shippingAddress.name && (
                                <p>{order.shippingAddress.name}</p>
                              )}
                              {order.shippingAddress.address1 && (
                                <p>{order.shippingAddress.address1}</p>
                              )}
                              {order.shippingAddress.address2 && (
                                <p>{order.shippingAddress.address2}</p>
                              )}
                              <p>
                                {[
                                  order.shippingAddress.city,
                                  order.shippingAddress.provinceCode,
                                  order.shippingAddress.zip,
                                ]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            </address>
                          ) : (
                            <p>N/A</p>
                          )}
                        </div>
                        <div className="min-w-0 text-left">
                          <h3 className="pb-3">Status:</h3>
                          <div>
                            <p className="cart-combined-savings-glow">
                              {displayFulfillmentStatus}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                  <div className="pt-3 totals flex justify-end items-end">
                    <Card className="grid grid-cols-1 w-full h-[60%] pe-6">
                      {discount && (
                        <div className="tr flex justify-between">
                          <div className="flex justify-center items-center">
                            <div className="th">
                              <p>Discounts</p>
                            </div>
                          </div>
                          <div className="flex justify-center items-center">
                            <div className="td">
                              <span>-{discount}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="tr flex justify-between">
                        <div className="flex justify-center items-center">
                          <div className="th">
                            <p>Subtotal</p>
                          </div>
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">{subtotal}</div>
                        </div>
                      </div>
                      <div className="tr flex justify-between">
                        <div className="flex justify-center items-center">
                          <div className="th">Tax</div>
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">{tax}</div>
                        </div>
                      </div>
                      <div className="tr flex justify-between">
                        <div className="flex justify-center items-center">
                          <div className="th">Total</div>
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">{total}</div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </>
  );
}

function TokenOrderLineRow({
  lineItem,
  hasDownload,
  signInUrl,
  lineItemTagsByLineItemId = {},
  lineItemProductsByLineItemId = {},
  lineItemSelectedOptionsByLineItemId = {},
  orderCustomerId,
  orderCustomerName,
  currentReviewReward,
  discountUsesRemaining,
  userReviewExistsByProductId = {},
  onReviewRewardChange,
}: {
  lineItem: AdminLineItem;
  hasDownload: boolean;
  signInUrl: string;
  lineItemTagsByLineItemId?: Record<string, string[]>;
  lineItemProductsByLineItemId?: Record<string, any>;
  lineItemSelectedOptionsByLineItemId?: Record<
    string,
    LineItemSelectedOption[]
  >;
  orderCustomerId?: string | null;
  orderCustomerName?: string | null;
  currentReviewReward?: ReviewMediaDiscountReward | null;
  discountUsesRemaining?: number | null;
  userReviewExistsByProductId?: Record<string, boolean>;
  onReviewRewardChange?: (reward: ReviewMediaDiscountReward | null) => void;
}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lineItemProduct = lineItemProductsByLineItemId[lineItem.id] ?? null;
  const selectedOptions =
    lineItemSelectedOptionsByLineItemId[lineItem.id] ?? [];

  const tagsFromLineItemMap = lineItemTagsByLineItemId[lineItem.id] ?? [];
  const tagsFromProduct = Array.isArray(lineItemProduct?.tags)
    ? (lineItemProduct.tags as string[])
    : [];
  const lineItemTags = tagsFromLineItemMap.length
    ? tagsFromLineItemMap
    : tagsFromProduct;
  const isStockClipFromTags = lineItemTags.includes('Video');
  const isBundleFromTags = lineItemTags.includes('Bundle');
  const isPrintFromTags =
    lineItemTags.includes('Prints') && !isStockClipFromTags;

  const imageUrl = lineItem.image?.url ?? '';
  const isHorizontalProductFromImage =
    imageUrl.includes('horPrimary') || imageUrl.includes('horOnly');
  const isVerticalProductFromImage =
    imageUrl.includes('vertOnly') || imageUrl.includes('vertPrimary');
  const isPrintFromImage =
    isHorizontalProductFromImage || isVerticalProductFromImage;

  const hasTypeFromTags = isStockClipFromTags || isPrintFromTags;
  const isStockClip = hasTypeFromTags ? isStockClipFromTags : !isPrintFromImage;
  const isPrint = hasTypeFromTags ? isPrintFromTags : isPrintFromImage;

  const originalAmount = parseFloat(lineItem.originalTotalSet.shopMoney.amount);
  const discountedAmount = parseFloat(
    lineItem.discountedTotalSet.shopMoney.amount,
  );
  const lineDiscountAmount = originalAmount - discountedAmount;
  const currencyCode = lineItem.originalTotalSet.shopMoney.currencyCode;

  const fallbackPreview = (
    <div>
      <div className="grid grid-cols-1 pb-3">
        <div className="flex justify-center">
          <p>
            <strong>{lineItem.title}</strong>
          </p>
        </div>
        <div className="flex justify-center">
          {isPrint && (
            <p className="text-muted-foreground">Framed Canvas Print</p>
          )}
          {isStockClip && (
            <p className="text-muted-foreground">
              {isBundleFromTags
                ? 'Stock Footage Bundle'
                : 'Stock Footage Video'}
            </p>
          )}
        </div>
        <div className="flex justify-center">
          <small>{lineItem.variantTitle}</small>
        </div>
      </div>
      {lineItem.image?.url ? (
        <div className="flex justify-center">
          <img
            src={lineItem.image.url}
            alt={lineItem.image.altText ?? lineItem.title ?? 'Ordered item'}
            className="max-h-[250px] rounded object-cover"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div key={lineItem.id} className="account-order-line-row">
      <div className="td pb-2">
        <div className="">
          {lineItemProduct && isPrint ? (
            <div className="mx-auto max-w-[800px]">
              <ProductCarousel
                product={lineItemProduct}
                layout="list"
                isInWishlist={false}
                isLoggedIn={TOKEN_LOGGED_IN_PROMISE}
                renderContext="account-orders-id"
              />
            </div>
          ) : null}

          {lineItemProduct && isStockClip ? (
            <div className="mx-auto max-w-[800px]">
              <EProductsContainer
                product={lineItemProduct}
                layout="list"
                isInWishlist={false}
                isLoggedIn={TOKEN_LOGGED_IN_PROMISE}
              />
            </div>
          ) : null}

          {(!lineItemProduct || (!isPrint && !isStockClip)) && fallbackPreview}
        </div>
        {isPrint ? (
          <div className="grid grid-cols-2">
            <div className="flex justify-center">
              <div className="min-w-0">
                {selectedOptions.map((option, optionIndex) => (
                  <div
                    key={`${lineItem.id}-${option.name}-${option.value}-${optionIndex}`}
                    className="flex justify-start pb-1"
                  >
                    {option.name}: &nbsp;{option.value}
                  </div>
                ))}
                {!selectedOptions.length && lineItem.variantTitle ? (
                  <div className="flex justify-start pb-1">
                    Variant: &nbsp;{lineItem.variantTitle}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="price-quantity-total">
                <div className="flex justify-start">
                  Price: &nbsp;
                  {formatMoney(
                    (originalAmount / lineItem.quantity).toFixed(2),
                    currencyCode,
                  )}
                </div>
                <div className="flex justify-start">
                  Quantity: &nbsp;{lineItem.quantity}
                </div>
                {lineDiscountAmount > 0.01 && (
                  <div className="flex justify-start">
                    Discount: &nbsp; -
                    {formatMoney(lineDiscountAmount.toFixed(2), currencyCode)}
                  </div>
                )}
                <div className="flex justify-start">
                  Total: &nbsp;
                  {formatMoney(discountedAmount.toFixed(2), currencyCode)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="price-quantity-total ps-3 pt-3">
            {selectedOptions.map((option, optionIndex) => (
              <div
                key={`${lineItem.id}-${option.name}-${option.value}-${optionIndex}`}
                className="flex justify-start pb-1"
              >
                {option.name}: &nbsp;{option.value}
              </div>
            ))}
            {!selectedOptions.length && lineItem.variantTitle ? (
              <div className="flex justify-start pb-1">
                Variant: &nbsp;{lineItem.variantTitle}
              </div>
            ) : null}
            <div className="flex justify-start">
              Price: &nbsp;
              {formatMoney(
                (originalAmount / lineItem.quantity).toFixed(2),
                currencyCode,
              )}
            </div>
            <div className="flex justify-start">
              Quantity: &nbsp;{lineItem.quantity}
            </div>
            {lineDiscountAmount > 0.01 && (
              <div className="flex justify-start">
                Discount: &nbsp; -
                {formatMoney(lineDiscountAmount.toFixed(2), currencyCode)}
              </div>
            )}
            <div className="flex justify-start">
              Total: &nbsp;
              {formatMoney(discountedAmount.toFixed(2), currencyCode)}
            </div>
          </div>
        )}
        {/* Download button — mobile (< 605px) */}
        {windowWidth && windowWidth < 605 && (
          <>
            {hasDownload && (
              <div className="td pt-3">
                <div className="flex justify-center align-center">
                  <Button variant="outline" className="mb-5" asChild>
                    <Link to={signInUrl}>Sign in to Download ↓</Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Download button — desktop (>= 605px) */}
      {windowWidth && windowWidth >= 605 && (
        <>
          {hasDownload && (
            <div className="td">
              <div className="flex justify-center align-center">
                <Button variant="outline" className="mb-5" asChild>
                  <Link to={signInUrl}>Sign in to Download ↓</Link>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review form for print products — customer ID from order enables the form */}
      {isPrint && lineItemProduct?.id && (
        <div className="border-t border-primary/20">
          <ReviewForm
            productId={lineItemProduct.id}
            productName={lineItemProduct.title ?? lineItem.title ?? 'Print'}
            customerId={orderCustomerId ?? undefined}
            customerName={orderCustomerName ?? undefined}
            userReviewExists={
              userReviewExistsByProductId[lineItemProduct.id] ?? false
            }
            isBlocked={false}
            updateExistingReviews={() => {}}
            showDiscountPromo
            reviewMediaDiscountReward={currentReviewReward ?? null}
            onReviewMediaDiscountRewardChange={onReviewRewardChange}
            showSignInToUseCode
            signInUrl={signInUrl}
            precomputedDiscountUsesRemaining={discountUsesRemaining ?? null}
          />
        </div>
      )}
    </div>
  );
}
