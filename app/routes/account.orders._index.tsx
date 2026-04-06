import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
  type MetaFunction,
} from '@remix-run/react';
import {
  Money,
  Pagination,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {Button} from '~/components/ui/button';
import {Input} from '~/components/ui/input';
import {Label} from '~/components/ui/label';
import {Card, CardContent, CardHeader} from '~/components/ui/card';
import Sectiontitle from '~/components/global/Sectiontitle';
import {useTouchCardHighlight} from '~/lib/touchCardHighlight';
import {navigateWithCardSplash} from '~/lib/cardNavigationSplash';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

const ADMIN_ORDER_LOOKUP_QUERY = `#graphql
  query AdminOrderLookup($first: Int!, $query: String!) {
    orders(first: $first, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      nodes {
        id
        name
        email
        customer {
          id
          email
        }
        shippingAddress {
          address1
          address2
        }
        billingAddress {
          address1
          address2
        }
      }
    }
  }
` as const;

const ADMIN_ORDER_ASSIGN_CUSTOMER_MUTATION = `#graphql
  mutation AdminAssignOrderCustomer($orderId: ID!, $customerId: ID!) {
    orderUpdate(input: {id: $orderId, customerId: $customerId}) {
      order {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
` as const;

const ADMIN_ORDER_PICKUP_STATUS_QUERY = `#graphql
  query AdminOrderPickupStatus($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        displayFulfillmentStatus
        shippingLine {
          title
          code
          source
          shippingRateHandle
        }
        lineItems(first: 50) {
          nodes {
            variant {
              product {
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
  }
` as const;

type OrderLookupActionData = {
  ok: boolean;
  error?: string;
  orderId?: string;
};

type AdminOrderLookupNode = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  customer?: {id?: string | null; email?: string | null} | null;
  shippingAddress?: {address1?: string | null; address2?: string | null} | null;
  billingAddress?: {address1?: string | null; address2?: string | null} | null;
};

type AdminOrderPickupStatusNode = {
  id?: string | null;
  displayFulfillmentStatus?: string | null;
  shippingLine?: {
    title?: string | null;
    code?: string | null;
    source?: string | null;
    shippingRateHandle?: string | null;
  } | null;
  lineItems?: {
    nodes?: Array<{
      variant?: {product?: {tags?: string[]} | null} | null;
    } | null> | null;
  } | null;
  events?: {nodes?: Array<{message?: string | null} | null> | null} | null;
};

function normalizeOrderNumber(value: string): string {
  return value.replace(/\D+/g, '');
}

function normalizeLookupValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function doesOrderMatchLookupProof(
  order: AdminOrderLookupNode,
  emailAddress: string,
  streetAddress: string,
) {
  const normalizedEmail = emailAddress.trim().toLowerCase();
  const normalizedStreet = normalizeLookupValue(streetAddress);

  const emailMatches = normalizedEmail.length
    ? [order.email, order.customer?.email]
        .map((value) => value?.trim().toLowerCase() ?? '')
        .some((value) => value === normalizedEmail)
    : false;

  const addressMatches = normalizedStreet.length
    ? [
        order.shippingAddress?.address1,
        order.shippingAddress?.address2,
        order.billingAddress?.address1,
        order.billingAddress?.address2,
      ]
        .map((value) => normalizeLookupValue(value ?? ''))
        .some(
          (value) =>
            value.length > 0 &&
            (value.includes(normalizedStreet) ||
              normalizedStreet.includes(value)),
        )
    : false;

  return emailMatches || addressMatches;
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

/**
 * Detect whether an order was fulfilled via in-store pickup (POS) based on its
 * shipping line. POS in-person orders either have no shipping line at all, or
 * have a shipping line whose title looks like a physical address / pickup handle.
 */
function isPickupOrderPurchaseMethod(
  shippingLine?: AdminOrderPickupStatusNode['shippingLine'],
): boolean {
  // POS in-person orders typically have no shipping line — treat as pickup.
  if (!shippingLine) {
    return true;
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

type OrderComposition = 'eproduct-only' | 'mixed' | 'print-or-other';

/**
 * Determine the product composition of an order from its line item tags.
 * - `eproduct-only`: all items are stock footage (Video), no prints
 * - `mixed`: has both stock footage (Video) and physical prints (Prints)
 * - `print-or-other`: only prints or unknown items
 */
function getOrderComposition(
  node: AdminOrderPickupStatusNode | null | undefined,
): OrderComposition {
  const items = node?.lineItems?.nodes;
  if (!Array.isArray(items) || items.length === 0) return 'print-or-other';

  let hasEProduct = false;
  let hasPrint = false;

  for (const item of items) {
    const tags = item?.variant?.product?.tags ?? [];
    const isVideo = tags.includes('Video');
    const isPrint = tags.includes('Prints') && !isVideo;
    if (isVideo) hasEProduct = true;
    if (isPrint) hasPrint = true;
  }

  if (hasEProduct && !hasPrint) return 'eproduct-only';
  if (hasEProduct && hasPrint) return 'mixed';
  return 'print-or-other';
}

function getAdminOrderFulfillmentStatusMap(
  adminNodes: Array<AdminOrderPickupStatusNode | null | undefined>,
) {
  const statusByOrderId = new Map<string, string>();

  for (const node of adminNodes) {
    const orderId = typeof node?.id === 'string' ? node.id : null;
    if (!orderId) continue;

    const composition = getOrderComposition(node);
    const fallbackAdminStatus =
      typeof node?.displayFulfillmentStatus === 'string'
        ? node.displayFulfillmentStatus
        : null;

    // Digital-only orders (all stock footage, no prints) → always "Delivered".
    if (composition === 'eproduct-only') {
      statusByOrderId.set(orderId, 'DELIVERED');
      continue;
    }

    // Mixed orders (prints + stock footage) → status depends on print shipment.
    if (composition === 'mixed') {
      if (isDeliveredStatus(fallbackAdminStatus)) {
        statusByOrderId.set(orderId, 'DELIVERED');
      } else if (isFulfilledOrBeyond(fallbackAdminStatus)) {
        statusByOrderId.set(orderId, 'MIXED_PRINTS_SHIPPED');
      } else {
        statusByOrderId.set(orderId, 'MIXED_PREPARING_PRINTS');
      }
      continue;
    }

    // Print-only / other orders — existing pickup + event logic.
    const eventMessages = Array.isArray(node?.events?.nodes)
      ? node.events!.nodes!.map((eventNode) => eventNode?.message)
      : [];
    const pickupStatusFromEvents =
      getPickupStatusFromOrderEvents(eventMessages);

    // For POS in-person sales, Shopify sets displayFulfillmentStatus to
    // FULFILLED without any pickup-specific event messages. Detect these by
    // checking the shipping line and override to "PICKED_UP".
    const isPickup = isPickupOrderPurchaseMethod(node?.shippingLine);
    let resolvedStatus = pickupStatusFromEvents ?? fallbackAdminStatus;

    if (
      isPickup &&
      !pickupStatusFromEvents &&
      isFulfilledOrBeyond(fallbackAdminStatus)
    ) {
      resolvedStatus = 'PICKED_UP';
    }

    if (resolvedStatus) {
      statusByOrderId.set(orderId, resolvedStatus);
    }
  }

  return statusByOrderId;
}

export const meta: MetaFunction = () => {
  return [
    ...buildIconLinkPreviewMeta('Adam Underwater | My Orders'),
    {name: 'robots', content: 'noindex, nofollow'},
  ];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const isLoggedIn = await context.customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    return {customer: null, isLoggedIn};
  }

  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const {data, errors} = await context.customerAccount.query(
    CUSTOMER_ORDERS_QUERY,
    {
      variables: {
        ...paginationVariables,
      },
    },
  );

  if (errors?.length || !data?.customer) {
    return {customer: null, isLoggedIn};
  }

  const orderNodes = Array.isArray(data.customer.orders?.nodes)
    ? data.customer.orders.nodes
    : [];
  const orderIds = orderNodes
    .map((orderNode) => orderNode?.id)
    .filter((orderId): orderId is string => typeof orderId === 'string');
  const adminOrderStatusById = new Map<string, string>();

  if (orderIds.length) {
    try {
      const adminStatusResponse = await adminGraphql<{
        data?: {
          nodes?: Array<AdminOrderPickupStatusNode | null> | null;
        };
      }>({
        env: context.env,
        query: ADMIN_ORDER_PICKUP_STATUS_QUERY,
        variables: {ids: orderIds},
      });

      const adminStatusNodes = Array.isArray(adminStatusResponse?.data?.nodes)
        ? adminStatusResponse.data.nodes
        : [];
      const resolvedStatusMap =
        getAdminOrderFulfillmentStatusMap(adminStatusNodes);

      for (const [orderId, status] of resolvedStatusMap.entries()) {
        adminOrderStatusById.set(orderId, status);
      }
    } catch (error) {
      console.error('Failed to load Admin order pickup statuses', error);
    }
  }

  const customerWithOrderStatuses = {
    ...data.customer,
    orders: {
      ...data.customer.orders,
      nodes: orderNodes.map((orderNode) => ({
        ...orderNode,
        adminFulfillmentStatus: adminOrderStatusById.get(orderNode.id) ?? null,
      })),
    },
  };

  return {customer: customerWithOrderStatuses, isLoggedIn};
}

export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data<OrderLookupActionData>(
      {ok: false, error: 'Method not allowed.'},
      {status: 405},
    );
  }

  const isLoggedIn = await context.customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    return data<OrderLookupActionData>(
      {ok: false, error: 'Please sign in to look up an order.'},
      {status: 401},
    );
  }

  const formData = await request.formData();
  const formIntent = String(formData.get('_action') ?? '').trim();
  if (formIntent !== 'lookup-order') {
    return data<OrderLookupActionData>(
      {ok: false, error: 'Invalid form submission.'},
      {status: 400},
    );
  }

  const orderNumberRaw = String(formData.get('orderNumber') ?? '').trim();
  const emailAddress = String(formData.get('emailAddress') ?? '').trim();
  const streetAddress = String(formData.get('streetAddress') ?? '').trim();
  const normalizedOrderNumber = normalizeOrderNumber(orderNumberRaw);

  if (!normalizedOrderNumber) {
    return data<OrderLookupActionData>(
      {ok: false, error: 'Please enter a valid order number.'},
      {status: 400},
    );
  }

  if (!emailAddress && !streetAddress) {
    return data<OrderLookupActionData>(
      {
        ok: false,
        error:
          'Please enter your email address or street address with your order number.',
      },
      {status: 400},
    );
  }

  const customerResult = await context.customerAccount.query(
    CUSTOMER_DETAILS_QUERY,
  );
  const customerId = customerResult?.data?.customer?.id;
  if (typeof customerId !== 'string' || !customerId.length) {
    return data<OrderLookupActionData>(
      {ok: false, error: 'Unable to verify your customer account right now.'},
      {status: 400},
    );
  }

  const orderQueryString = `name:#${normalizedOrderNumber}`;
  let orderNodes: AdminOrderLookupNode[] = [];
  try {
    const orderLookupResponse = await adminGraphql<{
      data?: {orders?: {nodes?: AdminOrderLookupNode[] | null} | null};
    }>({
      env: context.env,
      query: ADMIN_ORDER_LOOKUP_QUERY,
      variables: {
        first: 20,
        query: orderQueryString,
      },
    });
    orderNodes = orderLookupResponse?.data?.orders?.nodes ?? [];
  } catch (error) {
    return data<OrderLookupActionData>(
      {
        ok: false,
        error: 'Order lookup is unavailable right now. Please try again.',
      },
      {status: 500},
    );
  }

  const matchingOrder = orderNodes.find((order) => {
    const candidateOrderNumber = normalizeOrderNumber(order?.name ?? '');
    if (
      !candidateOrderNumber ||
      candidateOrderNumber !== normalizedOrderNumber
    ) {
      return false;
    }

    return doesOrderMatchLookupProof(order, emailAddress, streetAddress);
  });

  if (!matchingOrder?.id) {
    return data<OrderLookupActionData>(
      {
        ok: false,
        error:
          'We could not find an order matching that order number and contact information.',
      },
      {status: 404},
    );
  }

  const existingCustomerId = matchingOrder.customer?.id?.trim() ?? '';
  if (existingCustomerId && existingCustomerId !== customerId) {
    return data<OrderLookupActionData>(
      {
        ok: false,
        error:
          'That order is already connected to a different customer account.',
      },
      {status: 409},
    );
  }

  if (!existingCustomerId) {
    try {
      const assignResult = await adminGraphql<{
        data?: {
          orderUpdate?: {
            order?: {id?: string | null} | null;
            userErrors?: Array<{message?: string | null}> | null;
          } | null;
        };
      }>({
        env: context.env,
        query: ADMIN_ORDER_ASSIGN_CUSTOMER_MUTATION,
        variables: {
          orderId: matchingOrder.id,
          customerId,
        },
      });

      const userErrors = assignResult?.data?.orderUpdate?.userErrors ?? [];
      if (userErrors.length) {
        const message =
          userErrors[0]?.message?.trim() ||
          'Unable to assign this order to your account.';
        return data<OrderLookupActionData>(
          {ok: false, error: message},
          {status: 400},
        );
      }
    } catch (error) {
      return data<OrderLookupActionData>(
        {
          ok: false,
          error:
            'We found your order but could not connect it to your account right now.',
        },
        {status: 500},
      );
    }
  }

  return data<OrderLookupActionData>({
    ok: true,
    orderId: matchingOrder.id,
  });
}

export default function Orders() {
  const {customer, isLoggedIn} = useLoaderData<{
    customer: CustomerOrdersFragment | null;
    isLoggedIn: boolean;
  }>();
  const lookupFetcher = useFetcher<OrderLookupActionData>();
  const revalidator = useRevalidator();
  const [lookupRequested, setLookupRequested] = useState(false);
  const [showLookupForm, setShowLookupForm] = useState(false);
  const handledLookupSignatureRef = useRef<string>('');
  const orders = customer?.orders;

  useEffect(() => {
    if (lookupRequested) {
      setShowLookupForm(true);
    }
  }, [lookupRequested]);

  useEffect(() => {
    if (lookupFetcher.state === 'submitting') {
      handledLookupSignatureRef.current = '';
    }
  }, [lookupFetcher.state]);

  useEffect(() => {
    if (lookupFetcher.state !== 'idle' || !lookupFetcher.data) return;
    const signature = JSON.stringify(lookupFetcher.data);
    if (handledLookupSignatureRef.current === signature) return;
    handledLookupSignatureRef.current = signature;

    if (lookupFetcher.data.ok) {
      toast.success('Order Found!');
      revalidator.revalidate();
      return;
    }

    if (lookupFetcher.data.error) {
      toast.error(lookupFetcher.data.error);
    }
  }, [lookupFetcher.data, lookupFetcher.state, revalidator]);

  if (!isLoggedIn || !orders) {
    return (
      <>
        <Sectiontitle text="My Orders" />
        <section className="orders flex justify-center pt-3">
          <p className="text-center">Sign in to view your orders.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Sectiontitle text="My Orders" />
      <section className="orders w-full pt-3">
        <div className="mx-4 mb-2 rounded-xl border border-input bg-background p-4">
          <p className="text-sm">
            Don&apos;t see your order? Look up your order made before signing
            up.
          </p>
          {!showLookupForm && (
            <div className="mt-3">
              <Button
                type="button"
                variant="default"
                onClick={() => setLookupRequested(true)}
              >
                Look up order
              </Button>
            </div>
          )}
          {showLookupForm && (
            <lookupFetcher.Form className="mt-4 space-y-3" method="post">
              <input type="hidden" name="_action" value="lookup-order" />
              <div className="space-y-1">
                <Label htmlFor="orderNumber">Order Number</Label>
                <Input
                  id="orderNumber"
                  name="orderNumber"
                  placeholder="Example: 1109"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emailAddress">Email Address</Label>
                <Input
                  id="emailAddress"
                  name="emailAddress"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input
                  id="streetAddress"
                  name="streetAddress"
                  placeholder="123 Ocean Ave"
                  autoComplete="street-address"
                />
              </div>
              {lookupFetcher.state === 'idle' &&
                lookupFetcher.data &&
                !lookupFetcher.data.ok &&
                lookupFetcher.data.error && (
                  <p className="text-sm text-destructive">
                    {lookupFetcher.data.error}
                  </p>
                )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="default"
                  disabled={lookupFetcher.state !== 'idle'}
                >
                  {lookupFetcher.state === 'idle'
                    ? 'Submit'
                    : 'Looking up order...'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setLookupRequested(false);
                    setShowLookupForm(false);
                  }}
                  disabled={lookupFetcher.state !== 'idle'}
                >
                  Cancel
                </Button>
              </div>
            </lookupFetcher.Form>
          )}
        </div>
        <div className="flex justify-center">
          {orders.nodes.length ? (
            <OrdersTable orders={orders} />
          ) : (
            <EmptyOrders />
          )}
        </div>
      </section>
    </>
  );
}

function OrdersTable({orders}: Pick<CustomerOrdersFragment, 'orders'>) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(() =>
    typeof window === 'undefined' ? undefined : window.innerWidth,
  );
  const gridColumnCount =
    windowWidth != undefined && windowWidth >= 950
      ? Math.floor((windowWidth - 950) / 400) + 2
      : 1;
  const orderGridStyle = {
    gridTemplateColumns: `repeat(${Math.max(1, gridColumnCount)}, minmax(0, 1fr))`,
  };

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="acccount-orders w-full">
      {orders?.nodes.length ? (
        <Pagination connection={orders}>
          {({nodes, isLoading, PreviousLink, NextLink}) => (
            <>
              <div className="mb-2 flex justify-center">
                <PreviousLink>
                  {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
                </PreviousLink>
              </div>
              <div className="grid gap-4 mx-4" style={orderGridStyle}>
                {nodes?.map((order) => (
                  <OrderItem key={order.id} order={order} />
                ))}
              </div>
              <div className="mt-2 flex justify-center">
                <NextLink>
                  {isLoading ? 'Loading...' : <span>Load more ↓</span>}
                </NextLink>
              </div>
            </>
          )}
        </Pagination>
      ) : (
        <EmptyOrders />
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div>
      {/* THIS IS CODE FOR APOSTROPHE */}
      <p>You haven&apos;t placed any orders yet.</p>
      <div className="flex justify-center mt-4">
        <Button variant="default">
          <Link to="/prints">Start Shopping →</Link>
        </Button>
      </div>
    </div>
  );
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

function getDisplayFinancialStatus(status?: string | null): string {
  const s = (status ?? '').trim().toUpperCase();
  switch (s) {
    case 'PAID':
      return 'Paid';
    case 'PARTIALLY_REFUNDED':
      return 'Refunded';
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

function isRefundedLikeFinancialStatus(status?: string | null): boolean {
  const s = (status ?? '').trim().toUpperCase();
  return s === 'REFUNDED' || s === 'PARTIALLY_REFUNDED';
}

function getDisplayOrderProcessedAt(processedAt: string) {
  const date = new Date(processedAt);
  return {
    dateLabel: date.toLocaleDateString('en-US'),
    timeLabel: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const navigate = useNavigate();
  const touchCardId = `order-card:${String(order.id)}`;
  const {isTouchHighlighted, touchHighlightHandlers} =
    useTouchCardHighlight(touchCardId);
  const touchCardEffects =
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const firstFulfillment = flattenConnection(order.fulfillments)[0];
  const fulfillmentStatus = firstFulfillment?.status;
  const trackingInfo = (firstFulfillment as any)?.trackingInformation;
  const firstTracking = (
    Array.isArray(trackingInfo) ? trackingInfo[0] : null
  ) as {number?: string | null; url?: string | null} | null;
  const trackingNumber = firstTracking?.number ?? null;
  const trackingUrl = firstTracking?.url ?? null;
  const upsTrackingHref = trackingNumber
    ? trackingUrl ||
      `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`
    : null;
  const adminFulfillmentStatus = (
    order as unknown as {adminFulfillmentStatus?: string | null}
  ).adminFulfillmentStatus;
  const orderLevelFulfillmentStatus = (
    order as unknown as {fulfillmentStatus?: string | null}
  ).fulfillmentStatus;
  const refundedStatusOverride = isRefundedLikeFinancialStatus(
    order.financialStatus,
  )
    ? 'Refunded'
    : null;
  const displayFinancialStatus =
    refundedStatusOverride ?? getDisplayFinancialStatus(order.financialStatus);
  const displayFulfillmentStatus =
    refundedStatusOverride ??
    getDisplayFulfillmentStatus(
      adminFulfillmentStatus ??
        fulfillmentStatus ??
        orderLevelFulfillmentStatus,
    );
  const {dateLabel, timeLabel} = getDisplayOrderProcessedAt(order.processedAt);
  const orderPath = `/account/orders/${btoa(order.id)}`;
  const navigateToOrderWithSplash = (
    cardElement: HTMLElement | null | undefined,
  ) => {
    navigateWithCardSplash({
      card: cardElement,
      navigate: () => navigate(orderPath),
    });
  };

  return (
    <div className="h-full">
      <fieldset className="h-full">
        <Card
          className={`h-full cursor-pointer transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] focus-within:border-primary focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] ${isTouchHighlighted ? touchCardEffects : ''}`}
          style={{touchAction: 'pan-y'}}
          data-touch-highlight-card-id={touchCardId}
          {...touchHighlightHandlers}
          role="link"
          tabIndex={0}
          onClick={(event) => {
            navigateToOrderWithSplash(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigateToOrderWithSplash(event.currentTarget);
            }
          }}
        >
          <CardHeader>
            <Link
              to={orderPath}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const cardElement =
                  event.currentTarget.closest<HTMLElement>(
                    '[data-slot="card"]',
                  );
                navigateToOrderWithSplash(cardElement);
              }}
            >
              <strong>Order#: {order.number}</strong>
            </Link>
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <span>{dateLabel}</span>
              <span>{timeLabel}</span>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p>{displayFinancialStatus}</p>
                <p className="cart-combined-savings-glow">
                  {displayFulfillmentStatus}
                </p>
                <Money data={order.totalPrice} />
              </div>
              <div className="shrink-0">
                <Button
                  variant="default"
                  onClick={(event) => {
                    event.stopPropagation();
                    const cardElement =
                      event.currentTarget.closest<HTMLElement>(
                        '[data-slot="card"]',
                      );
                    navigateToOrderWithSplash(cardElement);
                  }}
                >
                  View Order →
                </Button>
              </div>
            </div>
            {trackingNumber && upsTrackingHref ? (
              <div className="mt-3 pt-3 border-t border-input">
                <p className="text-sm">
                  Tracking number:{' '}
                  <a
                    href={upsTrackingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {trackingNumber}
                  </a>
                </p>
                <p className="text-sm text-muted-foreground">UPS Ground</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </fieldset>
    </div>
  );
}
