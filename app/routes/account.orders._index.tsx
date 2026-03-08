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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '~/components/ui/card';
import Sectiontitle from '~/components/global/Sectiontitle';
import {useTouchCardHighlight} from '~/lib/touchCardHighlight';
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

export const meta: MetaFunction = () => {
  return buildIconLinkPreviewMeta('Adam Underwater | My Orders');
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

  return {customer: data.customer, isLoggedIn};
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
        error: 'Please enter your email address or street address with your order number.',
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
      {ok: false, error: 'Order lookup is unavailable right now. Please try again.'},
      {status: 500},
    );
  }

  const matchingOrder = orderNodes.find((order) => {
    const candidateOrderNumber = normalizeOrderNumber(order?.name ?? '');
    if (!candidateOrderNumber || candidateOrderNumber !== normalizedOrderNumber) {
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
        return data<OrderLookupActionData>({ok: false, error: message}, {status: 400});
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
        <div className="mx-5 mb-4 rounded-md border border-input bg-background p-4">
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
          {orders.nodes.length ? <OrdersTable orders={orders} /> : <EmptyOrders />}
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
          <Link to="/collections/prints">Start Shopping →</Link>
        </Button>
      </div>
    </div>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const navigate = useNavigate();
  const touchCardId = `order-card:${String(order.id)}`;
  const {isTouchHighlighted, touchHighlightHandlers} = useTouchCardHighlight(
    touchCardId,
  );
  const touchCardEffects =
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  const orderPath = `/account/orders/${btoa(order.id)}`;

  return (
    <div>
      <fieldset>
        <Card
          className={`cursor-pointer transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] focus-within:border-primary focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] ${isTouchHighlighted ? touchCardEffects : ''}`}
          style={{touchAction: 'pan-y'}}
          data-touch-highlight-card-id={touchCardId}
          {...touchHighlightHandlers}
          role="link"
          tabIndex={0}
          onClick={() => navigate(orderPath)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate(orderPath);
            }
          }}
        >
          <CardHeader>
            <Link
              to={orderPath}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <strong>Order#: {order.number}</strong>
            </Link>
            <p>{new Date(order.processedAt).toDateString()}</p>
          </CardHeader>

          <CardContent className="ms-3">
            <p>{order.financialStatus}</p>
            {fulfillmentStatus && <p>{fulfillmentStatus}</p>}
            <Money data={order.totalPrice} />
          </CardContent>
          <CardAction className="m-5">
            <Button
              variant="default"
              onClick={(event) => {
                event.stopPropagation();
                navigate(orderPath);
              }}
            >
              View Order →
            </Button>
          </CardAction>
        </Card>
      </fieldset>
    </div>
  );
}
