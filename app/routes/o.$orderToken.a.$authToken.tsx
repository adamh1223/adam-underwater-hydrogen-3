import {type LoaderFunctionArgs, type MetaFunction} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';

const PICKUP_ADDRESS_TEXT = '1080 8th Ave, San Diego, CA 92101';
const PICKUP_ADDRESS_MAP_URL = `https://maps.apple.com/?q=${encodeURIComponent(
  PICKUP_ADDRESS_TEXT,
)}`;

const ADMIN_ORDER_BY_TOKEN_QUERY = `#graphql
  query AdminOrderByToken($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
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
            title
            quantity
            variantTitle
            originalTotalSet {
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
          }
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
    nodes: Array<{
      title: string;
      quantity: number;
      variantTitle: string | null;
      originalTotalSet: {shopMoney: {amount: string; currencyCode: string}};
      image: {
        url: string;
        altText: string | null;
        width: number;
        height: number;
      } | null;
    }>;
  };
  events: {
    nodes: Array<{message: string | null}>;
  };
};

function isPickupOrder(
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

function getPickupStatusFromEvents(
  events: Array<{message: string | null}>,
): string | null {
  for (const event of events) {
    const msg = event.message?.toLowerCase().trim() ?? '';
    if (!msg) continue;

    if (
      msg.includes('marked as picked up') ||
      msg.includes('mark as picked up') ||
      (msg.includes('picked up') &&
        (msg.includes('order') || msg.includes('pickup')))
    ) {
      return 'PICKED_UP';
    }

    if (msg.includes('ready for pickup')) {
      return 'READY_FOR_PICKUP';
    }
  }
  return null;
}

function getDisplayStatus(
  fulfillmentStatus: string | null,
  events: Array<{message: string | null}>,
): string {
  const pickupStatus = getPickupStatusFromEvents(events);
  const status = (
    pickupStatus ??
    fulfillmentStatus ??
    ''
  )
    .trim()
    .toUpperCase();

  switch (status) {
    case 'FULFILLED':
    case 'SUCCESS':
    case 'DELIVERED':
      return 'Shipped';
    case 'READY_FOR_PICKUP':
      return 'Ready for Pickup';
    case 'PICKED_UP':
      return 'Picked Up';
    case 'IN_TRANSIT':
      return 'In Transit';
    case 'CANCELLED':
      return 'Cancelled';
    case 'UNFULFILLED':
      return 'Preparing';
    case 'PARTIALLY_FULFILLED':
      return 'Partially Fulfilled';
    default:
      return status ? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Processing';
  }
}

function getPaymentStatus(financialStatus: string | null): string {
  const status = (financialStatus ?? '').trim().toUpperCase();
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'PENDING':
      return 'Payment Pending';
    case 'REFUNDED':
      return 'Refunded';
    case 'PARTIALLY_REFUNDED':
      return 'Partially Refunded';
    case 'VOIDED':
      return 'Voided';
    default:
      return status ? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pending';
  }
}

function formatMoney(amount: string, currencyCode: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return `$0.00 ${currencyCode}`;
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

  const result = await adminGraphql<{
    data?: {
      orders?: {
        nodes?: AdminOrderNode[];
      };
    };
  }>({
    env: context.env,
    query: ADMIN_ORDER_BY_TOKEN_QUERY,
    variables: {query: `token:${orderToken}`},
  });

  const order = result?.data?.orders?.nodes?.[0];

  if (!order) {
    throw new Response('Order not found', {status: 404});
  }

  const pickup = isPickupOrder(order.shippingLine);
  const fulfillmentDisplay = getDisplayStatus(
    order.displayFulfillmentStatus,
    order.events.nodes,
  );
  const paymentDisplay = getPaymentStatus(order.displayFinancialStatus);

  return {
    order,
    isPickup: pickup,
    fulfillmentDisplay,
    paymentDisplay,
  };
}

export default function OrderStatusPage() {
  const {order, isPickup, fulfillmentDisplay, paymentDisplay} =
    useLoaderData<typeof loader>();

  const lineItems = order.lineItems.nodes;
  const createdAt = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
  const discountAmount = parseFloat(
    order.totalDiscountsSet.shopMoney.amount,
  );
  const discount =
    discountAmount > 0
      ? formatMoney(
          order.totalDiscountsSet.shopMoney.amount,
          order.totalDiscountsSet.shopMoney.currencyCode,
        )
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Order {order.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placed on {createdAt}
        </p>
      </div>

      {/* Status badges */}
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          {fulfillmentDisplay}
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-4 py-1.5 text-sm font-medium">
          {paymentDisplay}
        </span>
      </div>

      {/* Pickup / Shipping address */}
      <div className="mb-6 rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isPickup ? 'Pickup Location' : 'Shipping Address'}
        </h2>
        {isPickup ? (
          <a
            href={PICKUP_ADDRESS_MAP_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-medium hover:underline underline-offset-4"
          >
            {PICKUP_ADDRESS_TEXT}
          </a>
        ) : order.shippingAddress ? (
          <address className="not-italic leading-relaxed">
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
          <p className="text-muted-foreground">No address available</p>
        )}
      </div>

      {/* Line items */}
      <div className="mb-6 rounded-lg border">
        <h2 className="border-b p-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Items
        </h2>
        <ul className="divide-y">
          {lineItems.map((item, index) => (
            <li key={index} className="flex gap-4 p-4">
              {item.image?.url ? (
                <img
                  src={`${item.image.url}&width=120`}
                  alt={item.image.altText ?? item.title}
                  width={60}
                  height={60}
                  className="h-[60px] w-[60px] rounded-md object-cover"
                />
              ) : (
                <div className="flex h-[60px] w-[60px] items-center justify-center rounded-md bg-muted">
                  <span className="text-xs text-muted-foreground">
                    No image
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col justify-center min-w-0">
                <p className="font-medium leading-snug">{item.title}</p>
                {item.variantTitle &&
                  item.variantTitle !== 'Default Title' && (
                    <p className="text-sm text-muted-foreground">
                      {item.variantTitle}
                    </p>
                  )}
                <p className="text-sm text-muted-foreground">
                  Qty: {item.quantity}
                </p>
              </div>
              <div className="flex items-center">
                <p className="font-medium">
                  {formatMoney(
                    item.originalTotalSet.shopMoney.amount,
                    item.originalTotalSet.shopMoney.currencyCode,
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals */}
      <div className="mb-8 rounded-lg border p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{subtotal}</span>
          </div>
          {discount && (
            <div className="flex justify-between text-sm">
              <span>Discount</span>
              <span className="text-green-600">-{discount}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>{tax}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span>{total}</span>
          </div>
        </div>
      </div>

      {/* Link to store */}
      <div className="text-center">
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
