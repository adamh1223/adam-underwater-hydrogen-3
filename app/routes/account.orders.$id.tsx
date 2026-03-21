import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction, Link} from '@remix-run/react';
import {Money, flattenConnection} from '@shopify/hydrogen';
import type {OrderLineItemFullFragment} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {Card, CardContent} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import Sectiontitle from '~/components/global/Sectiontitle';
import {getR2ObjectKeyFromTagsForVariant} from '~/lib/downloads';
import {ProductCarousel} from '~/components/products/productCarousel';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';
import ReviewForm from '~/components/form/ReviewForm';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {
  parseReviewMediaDiscountReward,
  type ReviewMediaDiscountReward,
} from '~/lib/reviewMediaDiscountReward';

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

const PICKUP_ADDRESS_TEXT = '1080 8th Ave, San Diego, CA 92101';
const PICKUP_ADDRESS_APPLE_MAPS_URL = `https://maps.apple.com/?q=${encodeURIComponent(
  PICKUP_ADDRESS_TEXT,
)}`;

const ADMIN_ORDER_DETAIL_PICKUP_STATUS_QUERY = `#graphql
  query AdminOrderDetailPickupStatus($id: ID!) {
    node(id: $id) {
      ... on Order {
        id
        displayFulfillmentStatus
        shippingLine {
          title
          code
          source
          shippingRateHandle
        }
        events(first: 15, reverse: true) {
          nodes {
            message
          }
        }
      }
    }
  }
` as const;

const ACCOUNT_LOGGED_IN_PROMISE = Promise.resolve(true);
type LineItemSelectedOption = {name: string; value: string};

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

function getDisplayFulfillmentStatus(fulfillmentStatus?: string | null): string {
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

function isPickupOrderPurchaseMethod(
  shippingLine?: {
    title?: string | null;
    code?: string | null;
    source?: string | null;
    shippingRateHandle?: string | null;
  },
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
  const shippingRateHandle =
    shippingLine.shippingRateHandle?.trim().toLowerCase() ?? '';

  const titleLooksLikeAddress =
    /\d/.test(title) &&
    /\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place)\b/i.test(
      title,
    );

  return (
    source === 'shopify' &&
    title.length > 0 &&
    (code === title || titleLooksLikeAddress || shippingRateHandle.includes('pickup'))
  );
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const orderName =
    typeof data?.order?.name === 'string' ? data.order.name.trim() : '';
  return buildIconLinkPreviewMeta(
    orderName
      ? `Adam Underwater | Order ${orderName}`
      : 'Adam Underwater | My Orders',
  );
};

export async function loader({params, context}: LoaderFunctionArgs) {
  if (!params.id) {
    return redirect('/account/orders');
  }
  const {storefront} = context;
  const orderId = atob(params.id);
  const {data, errors} = await context.customerAccount.query(
    CUSTOMER_ORDER_QUERY,
    {
      variables: {orderId},
    },
  );

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  const lineItems = flattenConnection(order.lineItems);
  const discountApplications = flattenConnection(order.discountApplications);

  const fulfillmentStatus =
    //@ts-expect-error order is any
    flattenConnection(order.fulfillments)[0]?.status ?? 'N/A';
  let adminFulfillmentStatus: string | null = null;
  let pickupStatusFromEvents: string | null = null;
  let adminShippingLine: {
    title?: string | null;
    code?: string | null;
    source?: string | null;
    shippingRateHandle?: string | null;
  } | null = null;
  try {
    const adminStatusResponse = await adminGraphql<{
      data?: {
        node?: {
          displayFulfillmentStatus?: string | null;
          shippingLine?: {
            title?: string | null;
            code?: string | null;
            source?: string | null;
            shippingRateHandle?: string | null;
          } | null;
          events?: {
            nodes?: Array<{message?: string | null} | null> | null;
          } | null;
        } | null;
      };
    }>({
      env: context.env,
      query: ADMIN_ORDER_DETAIL_PICKUP_STATUS_QUERY,
      variables: {id: order.id},
    });
    const eventMessages = Array.isArray(adminStatusResponse?.data?.node?.events?.nodes)
      ? adminStatusResponse.data.node.events.nodes.map((eventNode) => eventNode?.message)
      : [];
    pickupStatusFromEvents = getPickupStatusFromOrderEvents(eventMessages);
    const fallbackAdminStatus =
      typeof adminStatusResponse?.data?.node?.displayFulfillmentStatus === 'string'
        ? adminStatusResponse.data.node.displayFulfillmentStatus
        : null;
    adminFulfillmentStatus = pickupStatusFromEvents ?? fallbackAdminStatus;
    adminShippingLine = adminStatusResponse?.data?.node?.shippingLine ?? null;
  } catch {
    adminFulfillmentStatus = null;
  }
  //@ts-expect-error order is any
  const firstDiscount = discountApplications[0]?.value;

  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' && firstDiscount;

  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue' &&
    firstDiscount?.percentage;

  const variantIds = Array.from(
    new Set(
      lineItems
        .map((lineItem: any) => lineItem?.variantId)
        .filter(
          (variantId): variantId is string => typeof variantId === 'string',
        ),
    ),
  );
  const variantResponses = await Promise.all(
    variantIds.map((id) =>
      storefront
        .query(ORDER_LINE_ITEM_VARIANT_DETAILS_QUERY, {
          variables: {
            id,
          },
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
    const variant = response?.node as any;
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

  const lineItemTagsByLineItemId = lineItems.reduce<Record<string, string[]>>(
    (acc, lineItem: any) => {
      const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
      const variantId =
        typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
      if (!lineItemId || !variantId) return acc;

      const variantMetadata = downloadMetadataByVariantId.get(variantId);
      if (!variantMetadata) return acc;

      acc[lineItemId] = variantMetadata.tags;
      return acc;
    },
    {},
  );

  const encodedOrderId = params.id;
  const downloadLinksByLineItemId = lineItems.reduce<Record<string, string>>(
    (acc, lineItem: any) => {
      const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
      const variantId =
        typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
      if (!lineItemId || !variantId) return acc;

      const variantMetadata = downloadMetadataByVariantId.get(variantId);
      if (!variantMetadata) return acc;
      const objectKey = getR2ObjectKeyFromTagsForVariant({
        tags: variantMetadata.tags,
        selectedOptions: variantMetadata.selectedOptions,
        variantTitle: lineItem?.variantTitle,
      });
      if (!objectKey) return acc;

      acc[lineItemId] =
        `/account/orders/${encodedOrderId}/download?lineItemId=${encodeURIComponent(lineItemId)}`;
      return acc;
    },
    {},
  );

  // Determine order composition and pickup status
  const hasAnyEProducts = Object.keys(downloadLinksByLineItemId).length > 0;
  const hasAnyPrints = Array.from(downloadMetadataByVariantId.values()).some(
    ({tags}) => tags.includes('Prints') && !tags.includes('Video'),
  );
  const isEProductOnly = hasAnyEProducts && !hasAnyPrints;
  const isMixedOrder = hasAnyEProducts && hasAnyPrints;

  const isPickupOrder = isPickupOrderPurchaseMethod(
    adminShippingLine ?? undefined,
    hasAnyEProducts,
  );

  const effectiveFulfillmentStatus = adminFulfillmentStatus ?? fulfillmentStatus;

  // Resolve fulfillment status based on order composition:
  // 1. E-product only → always "Delivered"
  // 2. Mixed (prints + stock footage) → depends on print shipment progress
  // 3. Print-only pickup → "Picked up in store"
  // 4. Otherwise → use Shopify's status
  let resolvedFulfillmentStatus: string | null;
  if (isEProductOnly) {
    resolvedFulfillmentStatus = 'DELIVERED';
  } else if (isMixedOrder) {
    if (isDeliveredStatus(effectiveFulfillmentStatus)) {
      resolvedFulfillmentStatus = 'DELIVERED';
    } else if (isFulfilledOrBeyond(effectiveFulfillmentStatus)) {
      resolvedFulfillmentStatus = 'MIXED_PRINTS_SHIPPED';
    } else {
      resolvedFulfillmentStatus = 'MIXED_PREPARING_PRINTS';
    }
  } else if (
    isPickupOrder &&
    !pickupStatusFromEvents &&
    isFulfilledOrBeyond(effectiveFulfillmentStatus)
  ) {
    resolvedFulfillmentStatus = 'PICKED_UP';
  } else {
    resolvedFulfillmentStatus = effectiveFulfillmentStatus;
  }
  const displayFulfillmentStatus = getDisplayFulfillmentStatus(
    resolvedFulfillmentStatus,
  );

  const lineItemProductsByLineItemId = lineItems.reduce<Record<string, any>>(
    (acc, lineItem: any) => {
      const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
      const variantId =
        typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
      if (!lineItemId || !variantId) return acc;

      const product = productByVariantId.get(variantId);
      if (!product) return acc;

      acc[lineItemId] = product;
      return acc;
    },
    {},
  );

  const lineItemSelectedOptionsByLineItemId = lineItems.reduce<
    Record<string, LineItemSelectedOption[]>
  >((acc, lineItem: any) => {
    const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
    const variantId =
      typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
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

  // Fetch customer data for review forms
  type CustomerInfo = {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    defaultAddress?: {
      zoneCode?: string | null;
      territoryCode?: string | null;
    } | null;
    reviewMediaDiscountReward?: {
      value?: string | null;
    } | null;
  };
  let customer: CustomerInfo | null = null;
  try {
    const customerResult = await context.customerAccount.query(
      CUSTOMER_DETAILS_QUERY,
    );
    if (!customerResult.errors?.length && customerResult.data?.customer) {
      const c = customerResult.data.customer as any;
      customer = {
        id: c.id,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        defaultAddress: c.defaultAddress
          ? {
              zoneCode: c.defaultAddress.zoneCode ?? null,
              territoryCode: c.defaultAddress.territoryCode ?? null,
            }
          : null,
        reviewMediaDiscountReward: c.reviewMediaDiscountReward ?? null,
      };
    }
  } catch {
    customer = null;
  }

  // Collect unique print product IDs to check for existing reviews
  const printProductIds = new Set<string>();
  for (const lineItem of lineItems) {
    const lineItemId = typeof (lineItem as any)?.id === 'string' ? (lineItem as any).id : '';
    const product = lineItemProductsByLineItemId[lineItemId];
    if (!product?.id) continue;
    const tags = Array.isArray(product.tags) ? product.tags : [];
    const isPrint = tags.includes('Prints') && !tags.includes('Video');
    if (isPrint) {
      printProductIds.add(product.id);
    }
  }

  // Fetch existing reviews for print products to check if user already reviewed
  const existingReviewsByProductId: Record<string, any[]> = {};
  if (printProductIds.size > 0 && customer?.id) {
    const reviewQueries = Array.from(printProductIds).map(async (productId) => {
      try {
        const result = await adminGraphql<{
          data?: {
            product?: {
              metafield?: {value?: string | null} | null;
            } | null;
          };
        }>({
          env: context.env,
          query: `
            query GetProductReviews($id: ID!) {
              product(id: $id) {
                metafield(namespace: "custom", key: "reviews") {
                  value
                }
              }
            }
          `,
          variables: {id: productId},
        });
        const metafieldValue = result?.data?.product?.metafield?.value;
        if (metafieldValue) {
          try {
            const reviews = JSON.parse(metafieldValue);
            if (Array.isArray(reviews)) {
              existingReviewsByProductId[productId] = reviews;
            }
          } catch {
            // ignore parse errors
          }
        }
      } catch {
        // ignore fetch errors
      }
    });
    await Promise.all(reviewQueries);
  }

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    displayFulfillmentStatus,
    isPickupOrder,
    downloadLinksByLineItemId,
    lineItemTagsByLineItemId,
    lineItemProductsByLineItemId,
    lineItemSelectedOptionsByLineItemId,
    customer,
    existingReviewsByProductId,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    displayFulfillmentStatus,
    isPickupOrder,
    downloadLinksByLineItemId,
    lineItemTagsByLineItemId,
    customer,
    existingReviewsByProductId: initialReviewsByProductId,
    lineItemProductsByLineItemId,
    lineItemSelectedOptionsByLineItemId,
  } = useLoaderData<typeof loader>();

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [reviewsByProductId, setReviewsByProductId] = useState<
    Record<string, any[]>
  >(initialReviewsByProductId ?? {});
  const initialReviewMediaDiscountReward = useMemo(
    () =>
      parseReviewMediaDiscountReward(
        customer?.reviewMediaDiscountReward?.value ?? null,
      ),
    [customer?.reviewMediaDiscountReward?.value],
  );
  const [reviewMediaDiscountReward, setReviewMediaDiscountReward] = useState<
    ReviewMediaDiscountReward | null
  >(initialReviewMediaDiscountReward);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  useEffect(() => {
    setReviewMediaDiscountReward(initialReviewMediaDiscountReward);
  }, [initialReviewMediaDiscountReward]);

  const handleReviewsUpdate = useCallback(
    (productId: string, reviews: any[]) => {
      setReviewsByProductId((prev) => ({...prev, [productId]: reviews}));
    },
    [],
  );

  return (
    <>
      <div>
        <Sectiontitle text="My Orders" />
        <div className="mx-3 mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
          <Button asChild variant="secondary" className="self-center gap-2">
            <Link to="/account/orders">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to All Orders</span>
            </Link>
          </Button>
          <div className="min-w-0 self-center">
            <p>
              <strong>Order {order.name}</strong>
            </p>
            <p>Placed on {new Date(order.processedAt!).toDateString()}</p>
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
                      {/* <table> */}
                      {lineItems.length <= 1 ? (
                        <Card className="p-3">
                          <div>
                            {lineItems.map((lineItem, lineItemIndex) => (
                              <OrderLineRow
                                key={`${lineItem.id ?? lineItemIndex}`}
                                lineItem={
                                  lineItem as unknown as OrderLineItemFullFragment
                                }
                                downloadLinksByLineItemId={
                                  downloadLinksByLineItemId
                                }
                                lineItemTagsByLineItemId={
                                  lineItemTagsByLineItemId
                                }
                                lineItemProductsByLineItemId={
                                  lineItemProductsByLineItemId
                                }
                                lineItemSelectedOptionsByLineItemId={
                                  lineItemSelectedOptionsByLineItemId
                                }
                                customer={customer}
                                reviewsByProductId={reviewsByProductId}
                                onReviewsUpdate={handleReviewsUpdate}
                                reviewMediaDiscountReward={
                                  reviewMediaDiscountReward
                                }
                                onReviewMediaDiscountRewardChange={
                                  setReviewMediaDiscountReward
                                }
                              />
                            ))}
                          </div>
                        </Card>
                      ) : (
                        <div className="space-y-5">
                          {lineItems.map((lineItem, lineItemIndex) => (
                            <Card
                              key={`${lineItem.id ?? lineItemIndex}`}
                              className="p-3"
                            >
                              <OrderLineRow
                                lineItem={
                                  lineItem as unknown as OrderLineItemFullFragment
                                }
                                downloadLinksByLineItemId={
                                  downloadLinksByLineItemId
                                }
                                lineItemTagsByLineItemId={
                                  lineItemTagsByLineItemId
                                }
                                lineItemProductsByLineItemId={
                                  lineItemProductsByLineItemId
                                }
                                lineItemSelectedOptionsByLineItemId={
                                  lineItemSelectedOptionsByLineItemId
                                }
                                customer={customer}
                                reviewsByProductId={reviewsByProductId}
                                onReviewsUpdate={handleReviewsUpdate}
                                reviewMediaDiscountReward={
                                  reviewMediaDiscountReward
                                }
                                onReviewMediaDiscountRewardChange={
                                  setReviewMediaDiscountReward
                                }
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
                            ) : order?.shippingAddress ? (
                              <address>
                                <p>{order.shippingAddress.name}</p>
                                {order.shippingAddress.formatted ? (
                                  <>
                                    <p>{order.shippingAddress.formatted[1]}</p>
                                    <p>{order.shippingAddress.formatted[2]}</p>
                                    <p>{order.shippingAddress.formatted[3]}</p>
                                  </>
                                ) : (
                                  ''
                                )}
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
                          {((discountValue && discountValue.amount) ||
                            discountPercentage) && (
                            <div className="tr flex justify-between">
                              {/* <tr className="flex justify-between"> */}
                              <div className="flex justify-center items-center">
                                <div className="th">
                                  {/* <th scope="row" colSpan={2}> */}
                                  <p>Discounts</p>
                                </div>
                              </div>
                              <div className="flex justify-center items-center">
                                <div className="td">
                                  {/* <td> */}
                                  {discountPercentage ? (
                                    <span>-{discountPercentage}% OFF</span>
                                  ) : (
                                    discountValue && <Money data={discountValue!} />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="tr flex justify-between">
                            {/* <tr className="flex justify-between"> */}
                            <div className="flex justify-center items-center">
                              <div className="th">
                                {/* <th scope="row" colSpan={2}> */}
                                <p>Subtotal</p>
                              </div>
                            </div>
                            <div className="flex justify-center items-center">
                              <div className="td">
                                {/* <td> */}
                                <Money data={order.subtotal!} />
                              </div>
                            </div>
                          </div>
                          <div className="tr flex justify-between">
                            {/*  <tr className="flex justify-between"> */}
                            <div className="flex justify-center items-center">
                              <div className="th">Tax</div>
                              {/* <th scope="row" colSpan={2}>
                                Tax
                              </th> */}
                            </div>
                            <div className="flex justify-center items-center">
                              <div className="td">
                                <Money data={order.totalTax!} />
                              </div>
                              {/* <td>
                                <Money data={order.totalTax!} />
                              </td> */}
                            </div>
                          </div>
                          <div className="tr flex justify-between">
                            {/* <tr className="flex justify-between"> */}
                            <div className="flex justify-center items-center">
                              <div className="th">Total</div>
                              {/* <th scope="row" colSpan={2}>
                                Total
                              </th> */}
                            </div>
                            <div className="flex justify-center items-center">
                              <div className="td">
                                <Money data={order.totalPrice!} />
                              </div>
                              {/* <td>
                                <Money data={order.totalPrice!} />
                              </td> */}
                            </div>
                          </div>
                        </Card>
                      </div>
                      <div className="flex justify-end items-end">
                        <Button variant="default" className="m-0 mt-5 lg:m-5">
                          <Link to={order.statusPageUrl} rel="noreferrer">
                            View Order Status →
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {windowWidth && windowWidth <= 604 && (
                <>
                  <div className="upper-part-small grid grid-cols-1 flex justify-start">
                    <div className="table">
                      {/* <table> */}

                      <div className="tbody">
                        {/* <tbody> */}
                        {lineItems.map((lineItem, lineItemIndex) => (
                          <Card
                            key={`${lineItem.id ?? lineItemIndex}`}
                            className="p-3 mb-3"
                          >
                            <OrderLineRow
                              lineItem={
                                lineItem as unknown as OrderLineItemFullFragment
                              }
                              downloadLinksByLineItemId={
                                downloadLinksByLineItemId
                              }
                              lineItemTagsByLineItemId={
                                lineItemTagsByLineItemId
                              }
                              lineItemProductsByLineItemId={
                                lineItemProductsByLineItemId
                              }
                              lineItemSelectedOptionsByLineItemId={
                                lineItemSelectedOptionsByLineItemId
                              }
                              customer={customer}
                              reviewsByProductId={reviewsByProductId}
                              onReviewsUpdate={handleReviewsUpdate}
                              reviewMediaDiscountReward={
                                reviewMediaDiscountReward
                              }
                              onReviewMediaDiscountRewardChange={
                                setReviewMediaDiscountReward
                              }
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
                            {isPickupOrder ? 'Pickup Address:' : 'Shipping Address:'}
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
                          ) : order?.shippingAddress ? (
                            <address>
                              <p>{order.shippingAddress.name}</p>
                              {order.shippingAddress.formatted ? (
                                <>
                                  <p>{order.shippingAddress.formatted[1]}</p>
                                  <p>{order.shippingAddress.formatted[2]}</p>
                                  <p>{order.shippingAddress.formatted[3]}</p>
                                </>
                              ) : (
                                ''
                              )}
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
                      {((discountValue && discountValue.amount) ||
                        discountPercentage) && (
                        <div className="tr flex justify-between">
                          {/* <tr className="flex justify-between"> */}
                          <div className="flex justify-center items-center">
                            <div className="th">
                              {/* <th scope="row" colSpan={2}> */}
                              <p>Discounts</p>
                            </div>
                          </div>
                          <div className="flex justify-center items-center">
                            <div className="td">
                              {/* <td> */}
                              {discountPercentage ? (
                                <span>-{discountPercentage}% OFF</span>
                              ) : (
                                discountValue && <Money data={discountValue!} />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="tr flex justify-between">
                        {/* <tr className="flex justify-between"> */}
                        <div className="flex justify-center items-center">
                          <div className="th">
                            {/* <th scope="row" colSpan={2}> */}
                            <p>Subtotal</p>
                          </div>
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">
                            {/* <td> */}
                            <Money data={order.subtotal!} />
                          </div>
                        </div>
                      </div>
                      <div className="tr flex justify-between">
                        {/*  <tr className="flex justify-between"> */}
                        <div className="flex justify-center items-center">
                          <div className="th">Tax</div>
                          {/* <th scope="row" colSpan={2}>
                                    Tax
                                  </th> */}
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">
                            <Money data={order.totalTax!} />
                          </div>
                          {/* <td>
                                    <Money data={order.totalTax!} />
                                  </td> */}
                        </div>
                      </div>
                      <div className="tr flex justify-between">
                        {/* <tr className="flex justify-between"> */}
                        <div className="flex justify-center items-center">
                          <div className="th">Total</div>
                          {/* <th scope="row" colSpan={2}>
                                    Total
                                  </th> */}
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">
                            <Money data={order.totalPrice!} />
                          </div>
                          {/* <td>
                                    <Money data={order.totalPrice!} />
                                  </td> */}
                        </div>
                      </div>
                    </Card>
                  </div>
                  <div className="flex justify-end items-end">
                    <Button variant="default" className="m-5">
                      <Link to={order.statusPageUrl} rel="noreferrer">
                        View Order Status →
                      </Link>
                    </Button>
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

function OrderLineRow({
  lineItem,
  downloadLinksByLineItemId = {},
  lineItemTagsByLineItemId = {},
  lineItemProductsByLineItemId = {},
  lineItemSelectedOptionsByLineItemId = {},
  customer = null,
  reviewsByProductId = {},
  onReviewsUpdate,
  reviewMediaDiscountReward = null,
  onReviewMediaDiscountRewardChange,
}: {
  lineItem: OrderLineItemFullFragment;
  downloadLinksByLineItemId?: Record<string, string>;
  lineItemTagsByLineItemId?: Record<string, string[]>;
  lineItemProductsByLineItemId?: Record<string, any>;
  lineItemSelectedOptionsByLineItemId?: Record<
    string,
    LineItemSelectedOption[]
  >;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    defaultAddress?: {
      zoneCode?: string | null;
      territoryCode?: string | null;
    } | null;
    reviewMediaDiscountReward?: {
      value?: string | null;
    } | null;
  } | null;
  reviewsByProductId?: Record<string, any[]>;
  onReviewsUpdate?: (productId: string, reviews: any[]) => void;
  reviewMediaDiscountReward?: ReviewMediaDiscountReward | null;
  onReviewMediaDiscountRewardChange?: (
    reward: ReviewMediaDiscountReward | null,
  ) => void;
}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const downloadUrl = downloadLinksByLineItemId[lineItem.id];
  const itemSubtotal =
    lineItem.quantity * Number(lineItem.price?.amount) -
    Number(lineItem.totalDiscount.amount);
  const selectedOptions =
    lineItemSelectedOptionsByLineItemId[lineItem.id] ?? [];

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lineItemProduct = lineItemProductsByLineItemId[lineItem.id] ?? null;
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

  const imageUrl = lineItem?.image?.url ?? '';
  const isHorizontalProductFromImage =
    imageUrl.includes('horPrimary') || imageUrl.includes('horOnly');
  const isVerticalProductFromImage =
    imageUrl.includes('vertOnly') || imageUrl.includes('vertPrimary');
  const isPrintFromImage =
    isHorizontalProductFromImage || isVerticalProductFromImage;

  const hasTypeFromTags = isStockClipFromTags || isPrintFromTags;
  const isStockClip = hasTypeFromTags ? isStockClipFromTags : !isPrintFromImage;
  const isPrint = hasTypeFromTags ? isPrintFromTags : isPrintFromImage;

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
      {lineItem?.image?.url ? (
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
            <div className="mx-auto max-w-[900px]">
              <ProductCarousel
                product={lineItemProduct}
                layout="list"
                isInWishlist={false}
                isLoggedIn={ACCOUNT_LOGGED_IN_PROMISE}
                renderContext="account-orders-id"
              />
            </div>
          ) : null}

          {lineItemProduct && isStockClip ? (
            <div className="mx-auto max-w-[900px]">
              <EProductsContainer
                product={lineItemProduct}
                layout="list"
                isInWishlist={false}
                isLoggedIn={ACCOUNT_LOGGED_IN_PROMISE}
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
                  <Money data={lineItem.price!} />
                </div>
                <div className="flex justify-start">
                  Quantity: &nbsp;{lineItem.quantity}
                </div>
                {lineItem.totalDiscount.amount != '0.0' && (
                  <div className="flex justify-start">
                    Discount: &nbsp; -
                    <Money data={lineItem.totalDiscount!} />
                  </div>
                )}
                <div className="flex justify-start">
                  Total: &nbsp;
                  <Money
                    data={{
                      amount: itemSubtotal.toString(),
                      currencyCode: 'USD',
                    }}
                  />
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
              <Money data={lineItem.price!} />
            </div>
            <div className="flex justify-start">
              Quantity: &nbsp;{lineItem.quantity}
            </div>
            {lineItem.totalDiscount.amount != '0.0' && (
              <div className="flex justify-start">
                Discount: &nbsp; -
                <Money data={lineItem.totalDiscount!} />
              </div>
            )}
            <div className="flex justify-start">
              Total: &nbsp;
              <Money
                data={{amount: itemSubtotal.toString(), currencyCode: 'USD'}}
              />
            </div>
          </div>
        )}
        {windowWidth && windowWidth < 605 && (
          <>
            {downloadUrl && (
              <div className="td pt-3">
                {/* <td> */}
                <div className="flex justify-center align-center">
                  {/* <Button variant="outline">Download ↓</Button> */}
                  {/* <a href={downloadLink[0]?.url}>download</a> */}
                  <Button variant="outline" className="mb-5" asChild>
                    <a href={downloadUrl}>Download ↓</a>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {windowWidth && windowWidth >= 605 && (
        <>
          {downloadUrl && (
            <div className="td">
              {/* <td> */}
              <div className="flex justify-center align-center">
                {/* <Button variant="outline">Download ↓</Button> */}
                {/* <a href={downloadLink[0]?.url}>download</a> */}
                <Button variant="outline" className="mb-5" asChild>
                  <a href={downloadUrl}>Download ↓</a>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review form for print products only */}
      {isPrint && lineItemProduct?.id && (
        <OrderLineReviewForm
          productId={lineItemProduct.id}
          productName={
            lineItemProduct.title ?? lineItem.title ?? 'Print'
          }
          customer={customer}
          existingReviews={reviewsByProductId[lineItemProduct.id] ?? []}
          onReviewsUpdate={onReviewsUpdate}
          reviewMediaDiscountReward={reviewMediaDiscountReward}
          onReviewMediaDiscountRewardChange={onReviewMediaDiscountRewardChange}
        />
      )}
    </div>
  );
}

function OrderLineReviewForm({
  productId,
  productName,
  customer,
  existingReviews,
  onReviewsUpdate,
  reviewMediaDiscountReward = null,
  onReviewMediaDiscountRewardChange,
}: {
  productId: string;
  productName: string;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    defaultAddress?: {
      zoneCode?: string | null;
      territoryCode?: string | null;
    } | null;
  } | null;
  existingReviews: any[];
  onReviewsUpdate?: (productId: string, reviews: any[]) => void;
  reviewMediaDiscountReward?: ReviewMediaDiscountReward | null;
  onReviewMediaDiscountRewardChange?: (
    reward: ReviewMediaDiscountReward | null,
  ) => void;
}) {
  const customerId = customer?.id ?? undefined;
  const customerName = [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .join(' ') || undefined;
  const customerState = customer?.defaultAddress?.zoneCode ?? undefined;
  const customerCountry = customer?.defaultAddress?.territoryCode ?? undefined;

  const userReviewExists = Boolean(
    customerId &&
      existingReviews.some(
        (review) => review.customerId === customerId,
      ),
  );

  const handleReviewsUpdate = useCallback(
    (reviews: any[]) => {
      onReviewsUpdate?.(productId, reviews);
    },
    [productId, onReviewsUpdate],
  );

  return (
    <div className="border-t border-primary/20">
      <ReviewForm
        productId={productId}
        productName={productName}
        customerId={customerId}
        customerName={customerName}
        customerState={customerState}
        customerCountry={customerCountry}
        userReviewExists={userReviewExists}
        isBlocked={false}
        updateExistingReviews={handleReviewsUpdate}
        successToast={{message: 'Review submitted!'}}
        submittedMessage="Thank you for your review!"
        showDiscountPromo
        reviewMediaDiscountReward={reviewMediaDiscountReward}
        onReviewMediaDiscountRewardChange={onReviewMediaDiscountRewardChange}
      />
    </div>
  );
}
