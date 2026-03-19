import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {adminGraphql, getShopifyAdminConfig} from '~/lib/shopify-admin.server';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';
import {Card, CardContent} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {useEffect, useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import Sectiontitle from '~/components/global/Sectiontitle';

const PICKUP_ADDRESS_TEXT = '1080 8th Ave, San Diego, CA 92101';
const PICKUP_ADDRESS_APPLE_MAPS_URL = `https://maps.apple.com/?q=${encodeURIComponent(
  PICKUP_ADDRESS_TEXT,
)}`;

const DOWNLOAD_TAG_PREFIXES = ['r2:', 'r2key:', 'r2-key:', 'r2/'] as const;

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

/**
 * Look up a Shopify order by its token using the REST Admin API.
 * The GraphQL Admin API does not support filtering orders by token,
 * so we use REST to find the order ID, then fetch full details via GraphQL.
 */
async function findOrderIdByToken(
  env: Env,
  orderToken: string,
): Promise<string | null> {
  const {adminEndpoint, adminToken} = getShopifyAdminConfig(env);
  // Derive the REST base URL from the GraphQL endpoint
  const restBase = adminEndpoint.replace('/graphql.json', '');

  const response = await fetch(
    `${restBase}/orders.json?status=any&fields=id,token&limit=250`,
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
    orders?: Array<{id: number; token: string}>;
  };

  const match = data.orders?.find((o) => o.token === orderToken);
  if (!match) return null;

  return `gid://shopify/Order/${match.id}`;
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
): boolean {
  if (!shippingLine) return false;
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

function getDisplayFulfillmentStatus(fulfillmentStatus?: string | null): string {
  const normalizedStatus = (fulfillmentStatus ?? '').trim().toUpperCase();
  if (!normalizedStatus) return 'Preparing Shipment';

  switch (normalizedStatus) {
    case 'SUCCESS':
    case 'DELIVERED':
    case 'FULFILLED':
      return 'Shipped';
    case 'READY_FOR_PICKUP':
      return 'Ready for pickup';
    case 'PICKED_UP':
      return 'Picked up in store';
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

function hasDownloadTag(tags: string[]): boolean {
  return tags.some((tag) =>
    DOWNLOAD_TAG_PREFIXES.some((prefix) => tag.trim().startsWith(prefix)),
  );
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
  const orderGid = await findOrderIdByToken(context.env, orderToken);
  if (!orderGid) {
    throw new Response('Order not found', {status: 404});
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
  const displayFulfillmentStatus = getDisplayFulfillmentStatus(
    adminFulfillmentStatus,
  );
  const isPickupOrder = isPickupOrderPurchaseMethod(order.shippingLine);

  // Determine which line items have downloads (e-products)
  const lineItemHasDownload: Record<string, boolean> = {};
  for (const lineItem of order.lineItems.nodes) {
    const tags = lineItem.variant?.product?.tags ?? [];
    lineItemHasDownload[lineItem.id] = hasDownloadTag(tags);
  }

  // Build the encoded order ID for the account order page redirect after sign-in
  // Admin API order ID is gid://shopify/Order/{numericId} — same format used by Customer Account API
  const encodedOrderId = btoa(order.id);
  const accountOrderPath = `/account/orders/${encodedOrderId}`;

  return {
    order,
    displayFulfillmentStatus,
    isPickupOrder,
    lineItemHasDownload,
    accountOrderPath,
  };
}

export default function OrderTokenStatusPage() {
  const {
    order,
    displayFulfillmentStatus,
    isPickupOrder,
    lineItemHasDownload,
    accountOrderPath,
  } = useLoaderData<typeof loader>();

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
    <div>
      <Sectiontitle text="Order Details" />
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

      <div className="account-order">
        <CardContent>
          <div>
            {windowWidth && windowWidth >= 605 ? (
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
                            windowWidth={windowWidth}
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
                            windowWidth={windowWidth}
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
            ) : (
              /* Mobile layout */
              <div>
                {lineItems.map((lineItem, index) => (
                  <Card key={lineItem.id ?? index} className="p-3 mb-3">
                    <TokenOrderLineRow
                      lineItem={lineItem}
                      hasDownload={lineItemHasDownload[lineItem.id] ?? false}
                      signInUrl={signInUrl}
                      windowWidth={windowWidth}
                    />
                  </Card>
                ))}

                <Card className="p-3 mb-3">
                  <div>
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
                  <div className="pt-3">
                    <h3 className="pb-3">
                      <strong>Status:</strong>
                    </h3>
                    <p className="cart-combined-savings-glow">
                      {displayFulfillmentStatus}
                    </p>
                  </div>
                </Card>

                <Card className="p-3">
                  {discount && (
                    <div className="flex justify-between pb-2">
                      <span>Discounts</span>
                      <span>-{discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between pb-2">
                    <span>Subtotal</span>
                    <span>{subtotal}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span>Tax</span>
                    <span>{tax}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total</span>
                    <span>{total}</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </div>

      <div className="flex justify-center pt-6 pb-10">
        <Link
          to="/"
          className="text-primary font-medium hover:underline underline-offset-4"
        >
          Visit our store
        </Link>
      </div>
    </div>
  );
}

function TokenOrderLineRow({
  lineItem,
  hasDownload,
  signInUrl,
  windowWidth,
}: {
  lineItem: AdminLineItem;
  hasDownload: boolean;
  signInUrl: string;
  windowWidth: number | undefined;
}) {
  const tags = lineItem.variant?.product?.tags ?? [];
  const isStockClip = tags.includes('Video');
  const isPrint = tags.includes('Prints') && !isStockClip;

  const imageUrl = lineItem.image?.url ?? '';
  const isHorizontalProductFromImage =
    imageUrl.includes('horPrimary') || imageUrl.includes('horOnly');
  const isVerticalProductFromImage =
    imageUrl.includes('vertOnly') || imageUrl.includes('vertPrimary');
  const isPrintFromImage =
    isHorizontalProductFromImage || isVerticalProductFromImage;

  const hasTypeFromTags = isStockClip || isPrint;
  const resolvedIsPrint = hasTypeFromTags ? isPrint : isPrintFromImage;
  const resolvedIsStockClip = hasTypeFromTags
    ? isStockClip
    : !isPrintFromImage;
  const isBundleFromTags = tags.includes('Bundle');

  const variantTitle = lineItem.variantTitle;
  const showVariant = variantTitle && variantTitle !== 'Default Title';

  const originalAmount = parseFloat(
    lineItem.originalTotalSet.shopMoney.amount,
  );
  const discountedAmount = parseFloat(
    lineItem.discountedTotalSet.shopMoney.amount,
  );
  const discountAmount = originalAmount - discountedAmount;
  const currencyCode = lineItem.originalTotalSet.shopMoney.currencyCode;

  return (
    <div className="account-order-line-row">
      <div className="td pb-2">
        <div>
          <div className="grid grid-cols-1 pb-3">
            <div className="flex justify-center">
              <p>
                <strong>{lineItem.title}</strong>
              </p>
            </div>
            <div className="flex justify-center">
              {resolvedIsPrint && (
                <p className="text-muted-foreground">Framed Canvas Print</p>
              )}
              {resolvedIsStockClip && (
                <p className="text-muted-foreground">
                  {isBundleFromTags
                    ? 'Stock Footage Bundle'
                    : 'Stock Footage Video'}
                </p>
              )}
            </div>
            {showVariant && (
              <div className="flex justify-center">
                <small>{variantTitle}</small>
              </div>
            )}
          </div>
          {lineItem.image?.url ? (
            <div className="flex justify-center">
              <img
                src={lineItem.image.url}
                alt={
                  lineItem.image.altText ?? lineItem.title ?? 'Ordered item'
                }
                className="max-h-[250px] rounded object-cover"
              />
            </div>
          ) : null}
        </div>

        <div className="price-quantity-total ps-3 pt-3">
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
          {discountAmount > 0.01 && (
            <div className="flex justify-start">
              Discount: &nbsp; -{formatMoney(discountAmount.toFixed(2), currencyCode)}
            </div>
          )}
          <div className="flex justify-start">
            Total: &nbsp;{formatMoney(discountedAmount.toFixed(2), currencyCode)}
          </div>
        </div>

        {/* Download button - triggers sign in */}
        {hasDownload && (
          <div className="td pt-3">
            <div className="flex justify-center align-center">
              <Button variant="outline" className="mb-5" asChild>
                <Link to={signInUrl}>Sign in to Download ↓</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
